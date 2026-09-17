import { NextResponse } from "next/server";
import { resolveGuestAccount } from "@/lib/guestSession";
import { getSupabaseServiceClient } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

const thresholds = [1000, 3000] as const;

export async function GET(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });

  const admin = getSupabaseServiceClient() as any;
  const [{ data: balance, error: balanceError }, { data: claims, error: claimsError }] = await Promise.all([
    admin.from("canfes_balances").select("amount, peak_amount").eq("account_id", account.id).maybeSingle(),
    admin.from("canfes_reward_claims").select("threshold, reward_name, claimed_at").eq("account_id", account.id),
  ]);

  if (balanceError || claimsError) return NextResponse.json({ error: "景品情報を読み込めませんでした" }, { status: 500 });

  return NextResponse.json({
    account: { display_name: account.display_name },
    balance: Number(balance?.amount ?? 0),
    peak_amount: Number(balance?.peak_amount ?? balance?.amount ?? 0),
    rewards: thresholds.map((threshold) => {
      const claim = (claims ?? []).find((item: { threshold: number }) => item.threshold === threshold);
      return {
        threshold,
        eligible: Number(balance?.peak_amount ?? balance?.amount ?? 0) >= threshold,
        claimed: Boolean(claim),
        reward_name: claim?.reward_name ?? `${threshold.toLocaleString()}CF到達景品`,
        claimed_at: claim?.claimed_at ?? null,
      };
    }),
  });
}
