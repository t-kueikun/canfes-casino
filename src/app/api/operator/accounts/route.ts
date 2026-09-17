import { NextResponse } from "next/server";
import { getSupabaseRouteClient, getSupabaseServiceClient, resolveRouteAuth } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

async function requireOperator(request: Request) {
  const client = await getSupabaseRouteClient(request);
  const { user } = await resolveRouteAuth(request, client);
  return user;
}

export async function GET(request: Request) {
  const user = await requireOperator(request);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  const admin = getSupabaseServiceClient() as any;
  const { data: accounts, error: accountsError } = await admin
    .from("canfes_accounts")
    .select("id, display_name, active, created_at, last_seen_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (accountsError) return NextResponse.json({ error: "参加者アカウントを読み込めませんでした" }, { status: 500 });

  const accountIds = (accounts ?? []).map((account: { id: string }) => account.id);
  const balances = accountIds.length === 0 ? [] : await admin
    .from("canfes_balances")
    .select("account_id, amount, peak_amount")
    .in("account_id", accountIds);
  if (balances.error) return NextResponse.json({ error: "参加者の残高を読み込めませんでした" }, { status: 500 });

  const rewardClaims = accountIds.length === 0 ? [] : await admin
    .from("canfes_reward_claims")
    .select("account_id, threshold, reward_name, claimed_at")
    .in("account_id", accountIds);
  if (rewardClaims.error) return NextResponse.json({ error: "景品付与状況を読み込めませんでした" }, { status: 500 });

  const balanceByAccount = new Map<string, number>(
    (balances.data ?? []).map((balance: { account_id: string; amount: number }) => [balance.account_id, Number(balance.amount ?? 0)]),
  );
  const peakByAccount = new Map<string, number>(
    (balances.data ?? []).map((balance: { account_id: string; peak_amount: number }) => [balance.account_id, Number(balance.peak_amount ?? 0)]),
  );
  const claimsByAccount = new Map<string, { threshold: 1000 | 3000; reward_name: string; claimed_at: string }[]>();
  for (const claim of rewardClaims.data ?? []) {
    const claims = claimsByAccount.get(claim.account_id) ?? [];
    claims.push({ threshold: claim.threshold, reward_name: claim.reward_name, claimed_at: claim.claimed_at });
    claimsByAccount.set(claim.account_id, claims);
  }

  const rewardState = (accountId: string) => [1000, 3000].map((threshold) => {
    const claim = claimsByAccount.get(accountId)?.find((item) => item.threshold === threshold);
    return {
      threshold,
      eligible: (peakByAccount.get(accountId) ?? 0) >= threshold,
      claimed: Boolean(claim),
      reward_name: claim?.reward_name ?? null,
      claimed_at: claim?.claimed_at ?? null,
    };
  });

  return NextResponse.json({
    data: (accounts ?? []).map((account: { id: string; display_name: string; active: boolean; created_at: string; last_seen_at: string }) => ({
      id: account.id,
      display_name: account.display_name,
      active: account.active,
      balance: balanceByAccount.get(account.id) ?? 0,
      peak_amount: peakByAccount.get(account.id) ?? 0,
      rewards: rewardState(account.id),
      created_at: account.created_at,
      last_seen_at: account.last_seen_at,
    })),
  });
}
