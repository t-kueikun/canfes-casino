import { NextResponse } from "next/server";
import { resolveGuestAccount } from "@/lib/guestSession";
import { getAppUrl } from "@/lib/appUrl";
import { createQrToken } from "@/lib/qrToken";
import { getSupabaseServiceClient } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { threshold?: number };
  const threshold: 1000 | 3000 | null = body.threshold === 1000 ? 1000 : body.threshold === 3000 ? 3000 : null;
  if (!threshold) return NextResponse.json({ error: "景品の指定が不正です" }, { status: 400 });

  const admin = getSupabaseServiceClient() as any;
  const [{ data: balance, error: balanceError }, { data: claim, error: claimError }] = await Promise.all([
    admin.from("canfes_balances").select("peak_amount").eq("account_id", account.id).maybeSingle(),
    admin.from("canfes_reward_claims").select("threshold").eq("account_id", account.id).eq("threshold", threshold).maybeSingle(),
  ]);
  if (balanceError || claimError) return NextResponse.json({ error: "景品の受け取り状況を確認できませんでした" }, { status: 500 });
  if (claim) return NextResponse.json({ error: "この景品はすでに受け取り済みです" }, { status: 409 });
  if (Number(balance?.peak_amount ?? 0) < threshold) return NextResponse.json({ error: `${threshold.toLocaleString()}CFに未到達です` }, { status: 400 });

  const token = createQrToken({
    type: "reward",
    accountId: account.id,
    threshold,
    expiresAt: Math.floor(Date.now() / 1000) + 10 * 60,
  });
  const url = new URL("/rewards/redeem", getAppUrl(request));
  url.searchParams.set("token", token);
  return NextResponse.json({ qr_url: url.toString(), expires_in_seconds: 600 });
}
