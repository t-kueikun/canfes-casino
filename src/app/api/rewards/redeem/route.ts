import { NextResponse } from "next/server";
import { getSupabaseRouteClient, getSupabaseServiceClient, resolveRouteAuth } from "@/lib/supabaseRoute";
import { readQrToken } from "@/lib/qrToken";

export const dynamic = "force-dynamic";

const rewardNames = { 1000: "1,000CF到達景品", 3000: "3,000CF到達景品" } as const;

function getPayload(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const payload = readQrToken(token);
  return payload?.type === "reward" ? payload : null;
}

async function requireOperator(request: Request) {
  const client = await getSupabaseRouteClient(request);
  const { user } = await resolveRouteAuth(request, client);
  return user;
}

export async function GET(request: Request) {
  const user = await requireOperator(request);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  const payload = getPayload(request);
  if (!payload) return NextResponse.json({ error: "QRコードが無効です" }, { status: 400 });
  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return NextResponse.json({ error: "QRコードの有効期限が切れています" }, { status: 410 });

  const admin = getSupabaseServiceClient() as any;
  const [{ data: account, error: accountError }, { data: claim, error: claimError }, { data: balance, error: balanceError }] = await Promise.all([
    admin.from("canfes_accounts").select("display_name, active").eq("id", payload.accountId).maybeSingle(),
    admin.from("canfes_reward_claims").select("claimed_at, reward_name").eq("account_id", payload.accountId).eq("threshold", payload.threshold).maybeSingle(),
    admin.from("canfes_balances").select("peak_amount").eq("account_id", payload.accountId).maybeSingle(),
  ]);
  if (accountError || claimError || balanceError) return NextResponse.json({ error: "景品情報を確認できませんでした" }, { status: 500 });
  if (!account?.active) return NextResponse.json({ error: "参加者アカウントが見つかりません" }, { status: 404 });

  return NextResponse.json({
    display_name: account.display_name,
    threshold: payload.threshold,
    reward_name: claim?.reward_name ?? rewardNames[payload.threshold],
    claimed: Boolean(claim),
    claimed_at: claim?.claimed_at ?? null,
    eligible: Number(balance?.peak_amount ?? 0) >= payload.threshold,
  });
}

export async function POST(request: Request) {
  const user = await requireOperator(request);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { token?: string };
  const payload = readQrToken(body.token);
  if (!payload || payload.type !== "reward") return NextResponse.json({ error: "QRコードが無効です" }, { status: 400 });
  if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return NextResponse.json({ error: "QRコードの有効期限が切れています" }, { status: 410 });

  const admin = getSupabaseServiceClient() as any;
  const { data: balance, error: balanceError } = await admin.from("canfes_balances").select("peak_amount").eq("account_id", payload.accountId).maybeSingle();
  if (balanceError) return NextResponse.json({ error: "景品の到達状況を確認できませんでした" }, { status: 500 });
  if (Number(balance?.peak_amount ?? 0) < payload.threshold) return NextResponse.json({ error: "景品の対象条件を満たしていません" }, { status: 409 });

  const { data, error } = await admin.from("canfes_reward_claims").insert({
    account_id: payload.accountId,
    threshold: payload.threshold,
    reward_name: rewardNames[payload.threshold],
  }).select("claimed_at, reward_name").single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "この景品はすでに受け取り済みです" }, { status: 409 });
    return NextResponse.json({ error: "景品の受け取りを記録できませんでした" }, { status: 500 });
  }
  return NextResponse.json({
    display_name: "",
    threshold: payload.threshold,
    reward_name: data.reward_name,
    claimed: true,
    claimed_at: data.claimed_at,
  }, { status: 201 });
}
