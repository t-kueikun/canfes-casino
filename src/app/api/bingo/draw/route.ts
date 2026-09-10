import { NextResponse } from "next/server";
import { getSupabaseRouteClient, getSupabaseServiceClient, resolveRouteAuth } from "@/lib/supabaseRoute";

export async function GET() {
  const admin = getSupabaseServiceClient() as any;
  const { data, error } = await admin.from("canfes_bingo_draw_state").select("drawn_numbers, current_number, active").eq("id", 1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { drawn_numbers: [], current_number: null, active: false });
}

export async function POST(request: Request) {
  const client = await getSupabaseRouteClient(request);
  const { user } = await resolveRouteAuth(request, client);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });
  const admin = getSupabaseServiceClient() as any;
  const { data: current } = await admin.from("canfes_bingo_draw_state").select("drawn_numbers").eq("id", 1).maybeSingle();
  const drawn = Array.isArray(current?.drawn_numbers) ? current.drawn_numbers as number[] : [];
  const available = Array.from({ length: 75 }, (_, index) => index + 1).filter((number) => !drawn.includes(number));
  if (!available.length) return NextResponse.json({ error: "すべての番号を抽選済みです" }, { status: 400 });

  const number = available[Math.floor(Math.random() * available.length)];
  const next = [...drawn, number];
  const { error } = await admin.from("canfes_bingo_draw_state").upsert({
    id: 1,
    drawn_numbers: next,
    current_number: number,
    active: true,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drawn_numbers: next, current_number: number, active: true });
}
