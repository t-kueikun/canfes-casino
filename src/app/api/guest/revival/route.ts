import { NextResponse } from "next/server";
import { resolveGuestAccount } from "@/lib/guestSession";
import { getSupabaseServiceClient } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

const REVIVAL_WAIT_MS = 20 * 60 * 1000;

export async function GET(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });

  const admin = getSupabaseServiceClient() as any;
  const [{ data: balanceRow, error: balanceError }, { data: requestRow, error: requestError }] = await Promise.all([
    admin.from("canfes_balances").select("amount").eq("account_id", account.id).maybeSingle(),
    admin.from("canfes_revival_requests").select("id, requested_at, eligible_at, status").eq("account_id", account.id).order("requested_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (balanceError || requestError) return NextResponse.json({ error: "復活申請の状態を読み込めませんでした" }, { status: 500 });

  return NextResponse.json({ balance: Number(balanceRow?.amount ?? 0), request: requestRow ?? null });
}

export async function POST(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });

  const admin = getSupabaseServiceClient() as any;
  const { data: balanceRow, error: balanceError } = await admin
    .from("canfes_balances")
    .select("amount")
    .eq("account_id", account.id)
    .maybeSingle();
  if (balanceError) return NextResponse.json({ error: "残高を確認できませんでした" }, { status: 500 });
  if (Number(balanceRow?.amount ?? 0) !== 0) {
    return NextResponse.json({ error: "残高が0になったときだけ申請できます" }, { status: 409 });
  }

  const { data: pendingRequest, error: pendingError } = await admin
    .from("canfes_revival_requests")
    .select("id")
    .eq("account_id", account.id)
    .eq("status", "pending")
    .maybeSingle();
  if (pendingError) return NextResponse.json({ error: "復活申請の状態を確認できませんでした" }, { status: 500 });
  if (pendingRequest) return NextResponse.json({ error: "すでに復活申請中です" }, { status: 409 });

  const requestedAt = new Date();
  const eligibleAt = new Date(requestedAt.getTime() + REVIVAL_WAIT_MS);
  const { data, error } = await admin
    .from("canfes_revival_requests")
    .insert({ account_id: account.id, requested_at: requestedAt.toISOString(), eligible_at: eligibleAt.toISOString() })
    .select("id, requested_at, eligible_at, status")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "すでに復活申請中です" }, { status: 409 });
    return NextResponse.json({ error: "復活申請を送信できませんでした" }, { status: 500 });
  }

  return NextResponse.json({ request: data }, { status: 201 });
}
