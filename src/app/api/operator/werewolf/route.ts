import { NextResponse } from "next/server";
import { getSupabaseRouteClient, getSupabaseServiceClient, resolveRouteAuth } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

async function requireOperator(request: Request) {
  const client = await getSupabaseRouteClient(request);
  const { user } = await resolveRouteAuth(request, client);
  return user;
}

function databaseErrorMessage(error: any) {
  if (error?.code === "42P01" && String(error.message).includes("canfes_werewolf")) {
    return "人狼企画用のテーブルがまだ設定されていません。docs/supabase-schema.sqlを実行してください。";
  }
  return error?.message ?? "人狼の進行情報を読み込めませんでした";
}

export async function GET(request: Request) {
  const user = await requireOperator(request);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  try {
    const admin = getSupabaseServiceClient() as any;
    const [{ data: state, error: stateError }, { data: players, error: playersError }] = await Promise.all([
      admin.from("canfes_werewolf_state").select("phase, round, updated_at").eq("id", 1).maybeSingle(),
      admin.from("canfes_werewolf_players").select("id, display_name").eq("active", true).order("created_at", { ascending: true }).limit(1000),
    ]);
    if (stateError || playersError) throw stateError ?? playersError;
    const current = state ?? { phase: "night", round: 0, updated_at: new Date().toISOString() };
    const { data: votes, error: votesError } = await admin
      .from("canfes_werewolf_votes")
      .select("target_player_id")
      .eq("round", current.round);
    if (votesError) throw votesError;
    const counts = new Map<string, number>();
    for (const vote of votes ?? []) if (vote.target_player_id) counts.set(vote.target_player_id, (counts.get(vote.target_player_id) ?? 0) + 1);
    return NextResponse.json({
      state: current,
      players: (players ?? []).map((player: { id: string; display_name: string }) => ({ id: player.id, display_name: player.display_name || "参加者", votes: counts.get(player.id) ?? 0 })),
      totalVotes: (votes ?? []).length,
    });
  } catch (error) {
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireOperator(request);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { phase?: string };
  if (body.phase !== "day" && body.phase !== "night") {
    return NextResponse.json({ error: "昼または夜を選択してください" }, { status: 400 });
  }

  try {
    const admin = getSupabaseServiceClient() as any;
    const { data: current, error: currentError } = await admin.from("canfes_werewolf_state").select("phase, round").eq("id", 1).maybeSingle();
    if (currentError) throw currentError;
    const previous = current ?? { phase: "night", round: 0 };
    const round = body.phase === "day" && previous.phase !== "day" ? Number(previous.round ?? 0) + 1 : Number(previous.round ?? 0);
    const { data, error } = await admin.from("canfes_werewolf_state").upsert({
      id: 1,
      phase: body.phase,
      round,
      updated_at: new Date().toISOString(),
    }).select("phase, round, updated_at").single();
    if (error) throw error;
    return NextResponse.json({ state: data });
  } catch (error) {
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}
