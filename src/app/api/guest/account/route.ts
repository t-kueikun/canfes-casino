import { NextResponse } from "next/server";
import {
  clearGuestSessionCookie,
  createGuestSessionToken,
  hashGuestSessionToken,
  resolveGuestAccount,
  setGuestSessionCookie,
} from "@/lib/guestSession";
import { getSupabaseServiceClient } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });

  const admin = getSupabaseServiceClient() as any;
  const { data: balance, error } = await admin
    .from("canfes_balances")
    .select("amount")
    .eq("account_id", account.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ account, balance: Number(balance?.amount ?? 0) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { code?: string; displayName?: string };
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 40) : "";
  if (!code) return NextResponse.json({ error: "QRコードのコードがありません" }, { status: 400 });

  const token = createGuestSessionToken();
  const admin = getSupabaseServiceClient() as any;
  const { data, error } = await admin.rpc("claim_canfes_access_code", {
    p_code: code,
    p_display_name: displayName || "参加者",
    p_session_token_hash: hashGuestSessionToken(token),
  });
  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("invalid_or_used_code")) {
      return NextResponse.json({ error: "無効、または使用済みのQRコードです" }, { status: 400 });
    }
    return NextResponse.json({ error: message || "アカウント作成に失敗しました" }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.account_id) return NextResponse.json({ error: "アカウント作成結果を取得できませんでした" }, { status: 500 });

  const response = NextResponse.json({
    account: {
      id: row.account_id,
      display_name: row.display_name,
      active: true,
    },
    balance: Number(row.balance ?? 0),
  }, { status: 201 });
  return setGuestSessionCookie(response, token);
}

export async function DELETE() {
  return clearGuestSessionCookie(NextResponse.json({ ok: true }));
}
