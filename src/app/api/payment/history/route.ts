import { NextResponse } from "next/server";
import { resolveGuestAccount } from "@/lib/guestSession";
import { getSupabaseServiceClient } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });

  const admin = getSupabaseServiceClient();
  const { data, error } = await admin
    .from("canfes_transactions")
    .select("id, name, amount, type, timestamp")
    .eq("account_id", account.id)
    .order("timestamp", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
