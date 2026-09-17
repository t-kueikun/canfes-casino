import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/appUrl";
import { createQrToken } from "@/lib/qrToken";
import { getSupabaseRouteClient, resolveRouteAuth } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const client = await getSupabaseRouteClient(request);
  const { user } = await resolveRouteAuth(request, client);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { amount?: number };
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
    return NextResponse.json({ error: "払い戻すチップ数は1〜100,000 CFの整数で入力してください" }, { status: 400 });
  }

  const token = createQrToken({
    type: "refund",
    requestId: randomUUID(),
    amount,
    expiresAt: Math.floor(Date.now() / 1000) + 10 * 60,
  });
  const url = new URL("/dashboard/payment", getAppUrl(request));
  url.searchParams.set("mode", "refund");
  url.searchParams.set("token", token);
  return NextResponse.json({ qr_url: url.toString(), amount, expires_in_seconds: 600 });
}
