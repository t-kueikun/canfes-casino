import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveGuestAccount } from "@/lib/guestSession";
import { readQrToken } from "@/lib/qrToken";
import { getSupabaseServiceClient } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });

  const token = new URL(request.url).searchParams.get("token");
  const payload = readQrToken(token);
  if (!payload || payload.type !== "refund") return NextResponse.json({ error: "払い戻しQRが無効です" }, { status: 400 });
  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return NextResponse.json({ error: "払い戻しQRの有効期限が切れています" }, { status: 410 });

  return NextResponse.json({
    payment: {
      amount: payload.amount,
      mode: "refund",
      expires_at: new Date(payload.expiresAt * 1000).toISOString(),
    },
  });
}

export async function POST(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { amount?: number; mode?: string; token?: string };
  const parsedPayload = body.token ? readQrToken(body.token) : null;
  const refundPayload = parsedPayload?.type === "refund" ? parsedPayload : null;
  if (body.token && !refundPayload) {
    return NextResponse.json({ error: "払い戻しQRが無効です" }, { status: 400 });
  }
  if (refundPayload && refundPayload.expiresAt <= Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: "払い戻しQRの有効期限が切れています" }, { status: 410 });
  }

  const mode = refundPayload ? "refund" : body.mode === "purchase" ? "purchase" : null;
  const amount = refundPayload?.amount ?? Number(body.amount);
  if (!mode || !Number.isInteger(amount) || amount < 1 || amount > 100000 || (mode === "refund" && !refundPayload)) {
    return NextResponse.json({ error: "金額は1〜100,000 CFの整数で入力してください" }, { status: 400 });
  }

  const admin = getSupabaseServiceClient() as any;
  const { data, error } = await admin.rpc("apply_canfes_payment_request", {
    p_request_id: refundPayload?.requestId ?? randomUUID(),
    p_account_id: account.id,
    p_amount: amount,
    p_mode: mode,
  });

  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("insufficient_balance")) {
      return NextResponse.json({ error: "残高が不足しているためチップを購入できません" }, { status: 409 });
    }
    if (message.includes("account_not_active")) {
      return NextResponse.json({ error: "参加者アカウントが見つかりません" }, { status: 404 });
    }
    if (message.includes("payment_request_conflict")) {
      return NextResponse.json({ error: "この払い戻しQRはすでに使用されています" }, { status: 409 });
    }
    return NextResponse.json({ error: "支払いを確定できませんでした。少し待ってからもう一度お試しください" }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) return NextResponse.json({ error: "支払い結果を確認できませんでした" }, { status: 500 });

  return NextResponse.json({
    completed: true,
    balance: Number(result.resulting_balance),
    amount,
    mode,
    display_name: result.display_name,
  });
}
