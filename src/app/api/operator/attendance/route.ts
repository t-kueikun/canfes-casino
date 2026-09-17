import { NextResponse } from "next/server";
import { getSupabaseRouteClient, getSupabaseServiceClient, resolveRouteAuth } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const client = await getSupabaseRouteClient(request);
  const { user } = await resolveRouteAuth(request, client);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  const admin = getSupabaseServiceClient() as any;
  const { data: accounts, error: accountsError } = await admin
    .from("canfes_accounts")
    .select("id, display_name, active, created_at, last_seen_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (accountsError) return NextResponse.json({ error: "来場受付を読み込めませんでした" }, { status: 500 });

  const accountIds = (accounts ?? []).map((account: { id: string }) => account.id);
  const { data: balances, error: balancesError } = accountIds.length === 0
    ? { data: [], error: null }
    : await admin.from("canfes_balances").select("account_id, amount").in("account_id", accountIds);
  if (balancesError) return NextResponse.json({ error: "来場者の残高を読み込めませんでした" }, { status: 500 });

  const balanceByAccount = new Map<string, number>(
    (balances ?? []).map((balance: { account_id: string; amount: number }) => [balance.account_id, Number(balance.amount ?? 0)]),
  );

  return NextResponse.json({
    data: (accounts ?? []).map((account: { id: string; display_name: string; active: boolean; created_at: string; last_seen_at: string }) => ({
      id: account.id,
      display_name: account.display_name || "参加者",
      active: account.active,
      balance: balanceByAccount.get(account.id) ?? 0,
      created_at: account.created_at,
      last_seen_at: account.last_seen_at,
    })),
  });
}
