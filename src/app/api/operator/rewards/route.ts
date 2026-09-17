import { NextResponse } from "next/server";
import { getSupabaseRouteClient, getSupabaseServiceClient, resolveRouteAuth } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

const rewardNames = {
  1000: "1,000CF到達景品",
  3000: "3,000CF到達景品",
} as const;

async function requireOperator(request: Request) {
  const client = await getSupabaseRouteClient(request);
  const { user } = await resolveRouteAuth(request, client);
  return user;
}

export async function POST(request: Request) {
  const user = await requireOperator(request);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { accountId?: string; threshold?: number };
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  const threshold: 1000 | 3000 | null = body.threshold === 1000 ? 1000 : body.threshold === 3000 ? 3000 : null;
  if (!accountId || !threshold) return NextResponse.json({ error: "景品付与対象が不正です" }, { status: 400 });

  const admin = getSupabaseServiceClient() as any;
  const { data: balance, error: balanceError } = await admin
    .from("canfes_balances")
    .select("peak_amount")
    .eq("account_id", accountId)
    .maybeSingle();
  if (balanceError) return NextResponse.json({ error: "参加者の到達状況を確認できませんでした" }, { status: 500 });
  if (!balance || Number(balance.peak_amount ?? 0) < threshold) {
    return NextResponse.json({ error: `${threshold.toLocaleString()}CFに未到達のため景品を付与できません` }, { status: 400 });
  }

  const { data: claim, error: claimError } = await admin
    .from("canfes_reward_claims")
    .insert({ account_id: accountId, threshold, reward_name: rewardNames[threshold], claimed_by: user.id })
    .select("account_id, threshold, reward_name, claimed_at")
    .single();

  if (claimError) {
    if (claimError.code === "23505") return NextResponse.json({ error: `${threshold.toLocaleString()}CF景品はすでに付与済みです` }, { status: 409 });
    return NextResponse.json({ error: "景品付与の記録に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ claim }, { status: 201 });
}
