import { NextResponse } from "next/server";
import { getSupabaseRouteClient, getSupabaseServiceClient, resolveRouteAuth } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

async function requireOperator(request: Request) {
  const client = await getSupabaseRouteClient(request);
  const { user } = await resolveRouteAuth(request, client);
  return user;
}

const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function GET(request: Request) {
  const user = await requireOperator(request);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  const admin = getSupabaseServiceClient() as any;
  const { data: requests, error: requestsError } = await admin
    .from("canfes_revival_requests")
    .select("id, account_id, requested_at, eligible_at")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(100);
  if (requestsError) return NextResponse.json({ error: "復活申請を読み込めませんでした" }, { status: 500 });

  const rows = requests ?? [];
  const accountIds = rows.map((row: { account_id: string }) => row.account_id);
  if (accountIds.length === 0) return NextResponse.json({ data: [], pendingCount: 0 });

  const [{ data: accounts, error: accountsError }, { data: balances, error: balancesError }] = await Promise.all([
    admin.from("canfes_accounts").select("id, display_name").in("id", accountIds),
    admin.from("canfes_balances").select("account_id, amount").in("account_id", accountIds),
  ]);
  if (accountsError || balancesError) return NextResponse.json({ error: "復活対象の参加者情報を読み込めませんでした" }, { status: 500 });

  const accountById = new Map<string, { display_name: string }>((accounts ?? []).map((account: { id: string; display_name: string }) => [account.id, account]));
  const balanceById = new Map<string, number>((balances ?? []).map((balance: { account_id: string; amount: number }) => [balance.account_id, Number(balance.amount ?? 0)]));
  const now = Date.now();
  return NextResponse.json({
    data: rows.map((row: { id: string; account_id: string; requested_at: string; eligible_at: string }) => ({
      id: row.id,
      accountId: row.account_id,
      displayName: accountById.get(row.account_id)?.display_name ?? "参加者",
      balance: balanceById.get(row.account_id) ?? 0,
      requestedAt: row.requested_at,
      eligibleAt: row.eligible_at,
      canApprove: new Date(row.eligible_at).getTime() <= now && (balanceById.get(row.account_id) ?? 0) === 0,
    })),
    pendingCount: rows.length,
  });
}

export async function POST(request: Request) {
  const user = await requireOperator(request);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { requestId?: string; action?: string };
  if (!isUuid(body.requestId) || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json({ error: "復活申請の指定が正しくありません" }, { status: 400 });
  }

  const admin = getSupabaseServiceClient() as any;
  if (body.action === "reject") {
    const { data, error } = await admin
      .from("canfes_revival_requests")
      .update({ status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", body.requestId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: "復活申請を却下できませんでした" }, { status: 500 });
    if (!data) return NextResponse.json({ error: "復活申請が見つからないか、処理済みです" }, { status: 404 });
    return NextResponse.json({ ok: true, action: "reject" });
  }

  const { data, error } = await admin.rpc("approve_canfes_revival", { p_request_id: body.requestId, p_staff_id: user.id });
  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("revival_not_ready")) return NextResponse.json({ error: "申請から20分経過後に承認できます" }, { status: 409 });
    if (message.includes("revival_balance_not_zero")) return NextResponse.json({ error: "残高が0ではないため復活できません" }, { status: 409 });
    if (message.includes("already_processed")) return NextResponse.json({ error: "この申請はすでに処理済みです" }, { status: 409 });
    if (message.includes("not_found")) return NextResponse.json({ error: "復活申請が見つかりません" }, { status: 404 });
    return NextResponse.json({ error: "復活処理に失敗しました" }, { status: 500 });
  }
  const result = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, action: "approve", displayName: result?.display_name ?? "参加者", balance: Number(result?.resulting_balance ?? 300) });
}
