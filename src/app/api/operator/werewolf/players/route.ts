import { NextResponse } from "next/server";
import { getSupabaseRouteClient, getSupabaseServiceClient, resolveRouteAuth } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const client = await getSupabaseRouteClient(request);
  const { user } = await resolveRouteAuth(request, client);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { display_name?: string };
  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  if (!displayName) return NextResponse.json({ error: "プレイヤー名を入力してください" }, { status: 400 });
  if (displayName.length > 40) return NextResponse.json({ error: "プレイヤー名は40文字以内で入力してください" }, { status: 400 });

  try {
    const admin = getSupabaseServiceClient() as any;
    const { data: existing, error: existingError } = await admin
      .from("canfes_werewolf_players")
      .select("id")
      .eq("active", true)
      .ilike("display_name", displayName)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return NextResponse.json({ error: "同じ名前のプレイヤーがすでにいます" }, { status: 409 });

    const { data, error } = await admin
      .from("canfes_werewolf_players")
      .insert({ display_name: displayName })
      .select("id, display_name, created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ player: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "プレイヤーを追加できませんでした" }, { status: 500 });
  }
}
