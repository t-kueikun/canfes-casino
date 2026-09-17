import { NextResponse } from "next/server";
import { getSupabaseRouteClient, getSupabaseServiceClient, resolveRouteAuth } from "@/lib/supabaseRoute";
import { readQrToken } from "@/lib/qrToken";

export const dynamic = "force-dynamic";

async function requireOperator(request: Request) {
  const client = await getSupabaseRouteClient(request);
  const { user } = await resolveRouteAuth(request, client);
  return user;
}

export async function GET(request: Request) {
  const user = await requireOperator(request);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  const token = new URL(request.url).searchParams.get("token");
  const payload = readQrToken(token);
  if (!payload || payload.type !== "payment") return NextResponse.json({ error: "QRコードが無効です" }, { status: 400 });
  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return NextResponse.json({ error: "QRコードの有効期限が切れています" }, { status: 410 });

  const admin = getSupabaseServiceClient() as any;
  const [{ data: account, error: accountError }, { data: transaction, error: transactionError }] = await Promise.all([
    admin.from("canfes_accounts").select("id, display_name, active").eq("id", payload.accountId).maybeSingle(),
    admin.from("canfes_transactions").select("id").eq("id", payload.requestId).maybeSingle(),
  ]);
  if (accountError || transactionError) return NextResponse.json({ error: "取引内容を確認できませんでした" }, { status: 500 });
  if (!account?.active) return NextResponse.json({ error: "参加者アカウントが見つかりません" }, { status: 404 });

  return NextResponse.json({
    payment: {
      mode: payload.mode,
      amount: payload.amount,
      display_name: account.display_name,
      expires_at: new Date(payload.expiresAt * 1000).toISOString(),
      completed: Boolean(transaction),
    },
  });
}

export async function POST(request: Request) {
  const user = await requireOperator(request);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { token?: string };
  const payload = readQrToken(body.token);
  if (!payload || payload.type !== "payment") return NextResponse.json({ error: "QRコードが無効です" }, { status: 400 });
  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return NextResponse.json({ error: "QRコードの有効期限が切れています" }, { status: 410 });

  const admin = getSupabaseServiceClient() as any;
  const { data, error } = await admin.rpc("apply_canfes_payment_request", {
    p_request_id: payload.requestId,
    p_account_id: payload.accountId,
    p_amount: payload.amount,
    p_mode: payload.mode,
  });
  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("insufficient_balance")) return NextResponse.json({ error: "残高が不足しているため払い戻しできません" }, { status: 409 });
    if (message.includes("account_not_active")) return NextResponse.json({ error: "参加者アカウントが見つかりません" }, { status: 404 });
    return NextResponse.json({ error: "取引を確定できませんでした。少し待ってから更新してください" }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) return NextResponse.json({ error: "取引結果を確認できませんでした" }, { status: 500 });
  return NextResponse.json({
    already_completed: Boolean(result.already_completed),
    balance: Number(result.resulting_balance),
    amount: payload.amount,
    mode: payload.mode,
    display_name: result.display_name,
  });
}
