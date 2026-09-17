import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveGuestAccount } from "@/lib/guestSession";
import { getSupabaseServiceClient } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { amount?: number; mode?: string };
  const amount = Number(body.amount);
  const mode = body.mode === "refund" ? "refund" : body.mode === "purchase" ? "purchase" : null;
  if (!mode || !Number.isInteger(amount) || amount < 1 || amount > 100000) {
    return NextResponse.json({ error: "金額は1〜100,000 CFの整数で入力してください" }, { status: 400 });
  }

  const admin = getSupabaseServiceClient() as any;
  const { data, error } = await admin.rpc("apply_canfes_payment_request", {
    p_request_id: randomUUID(),
    p_account_id: account.id,
    p_amount: amount,
    p_mode: mode,
  });

  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("insufficient_balance")) {
      return NextResponse.json({ error: "残高が不足しているため払い戻しできません" }, { status: 409 });
    }
    if (message.includes("account_not_active")) {
      return NextResponse.json({ error: "参加者アカウントが見つかりません" }, { status: 404 });
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
