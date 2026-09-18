import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseRoute";
import {
  createWerewolfVoterToken,
  hashWerewolfVoterToken,
  readWerewolfVoterToken,
  setWerewolfVoterCookie,
} from "@/lib/werewolfSession";

export const dynamic = "force-dynamic";

type WerewolfState = { phase: "night" | "day"; round: number; updated_at: string };
type WerewolfData = { state: WerewolfState; players: { id: string; display_name: string }[] };

// Audience clients poll together. Reuse the public roster briefly within a warm
// server instance while still returning a fresh voter cookie to each browser.
let cachedWerewolfData: { value: WerewolfData; expiresAt: number } | null = null;
let pendingWerewolfData: Promise<WerewolfData> | null = null;

function databaseErrorMessage(error: any) {
  if (error?.code === "42P01" && String(error.message).includes("canfes_werewolf")) {
    return "人狼企画用のテーブルがまだ設定されていません。運営に確認してください。";
  }
  return "人狼の進行情報を読み込めませんでした";
}

async function readWerewolfData(): Promise<WerewolfData> {
  if (cachedWerewolfData && cachedWerewolfData.expiresAt > Date.now()) return cachedWerewolfData.value;
  if (pendingWerewolfData) return pendingWerewolfData;

  pendingWerewolfData = (async () => {
    const admin = getSupabaseServiceClient() as any;
    const [{ data: state, error: stateError }, { data: players, error: playersError }] = await Promise.all([
      admin.from("canfes_werewolf_state").select("phase, round, updated_at").eq("id", 1).maybeSingle(),
      admin.from("canfes_werewolf_players").select("id, display_name").eq("active", true).order("created_at", { ascending: true }).limit(1000),
    ]);
    if (stateError || playersError) throw stateError ?? playersError;
    const value = {
      state: (state ?? { phase: "night", round: 0, updated_at: new Date().toISOString() }) as WerewolfState,
      players: (players ?? []).map((player: { id: string; display_name: string }) => ({ id: player.id, display_name: player.display_name || "参加者" })),
    };
    cachedWerewolfData = { value, expiresAt: Date.now() + 2000 };
    return value;
  })();

  try {
    return await pendingWerewolfData;
  } finally {
    pendingWerewolfData = null;
  }
}

export async function GET(request: Request) {
  try {
    const result = await readWerewolfData();
    const response = NextResponse.json(result);
    if (!readWerewolfVoterToken(request)) setWerewolfVoterCookie(response, createWerewolfVoterToken());
    return response;
  } catch (error) {
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { targetPlayerId?: string };
  if (!body.targetPlayerId || !/^[0-9a-f-]{36}$/i.test(body.targetPlayerId)) {
    return NextResponse.json({ error: "投票先を選択してください" }, { status: 400 });
  }

  try {
    const admin = getSupabaseServiceClient() as any;
    const { data: state, error: stateError } = await admin
      .from("canfes_werewolf_state")
      .select("phase, round, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (stateError) throw stateError;
    const current = (state ?? { phase: "night", round: 0 }) as WerewolfState;
    if (current.phase !== "day" || current.round < 1) {
      return NextResponse.json({ error: "現在は投票時間ではありません" }, { status: 409 });
    }

    const { data: target, error: targetError } = await admin
      .from("canfes_werewolf_players")
      .select("id, display_name")
      .eq("id", body.targetPlayerId)
      .eq("active", true)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: "投票先が見つかりません" }, { status: 400 });

    const token = readWerewolfVoterToken(request) ?? createWerewolfVoterToken();
    const { error: voteError } = await admin.from("canfes_werewolf_votes").upsert({
      round: current.round,
      voter_token_hash: hashWerewolfVoterToken(token),
      target_player_id: target.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "round,voter_token_hash" });
    if (voteError) throw voteError;

    const response = NextResponse.json({ ok: true, target: { id: target.id, display_name: target.display_name || "参加者" }, round: current.round });
    setWerewolfVoterCookie(response, token);
    return response;
  } catch (error) {
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}
