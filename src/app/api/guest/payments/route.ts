import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveGuestAccount } from "@/lib/guestSession";
import { getAppUrl } from "@/lib/appUrl";
import { createQrToken } from "@/lib/qrToken";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const account = await resolveGuestAccount(request);
  if (!account) return NextResponse.json({ error: "参加者アカウントがありません" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { amount?: number; mode?: string };
  const amount = Number(body.amount);
  const mode = body.mode === "refund" ? "refund" : body.mode === "purchase" ? "purchase" : null;
  if (!mode || !Number.isInteger(amount) || amount < 1 || amount > 100000) {
    return NextResponse.json({ error: "金額は1〜100,000 CFの整数で入力してください" }, { status: 400 });
  }

  const token = createQrToken({
    type: "payment",
    requestId: randomUUID(),
    accountId: account.id,
    amount,
    mode,
    expiresAt: Math.floor(Date.now() / 1000) + 5 * 60,
  });
  const url = new URL("/operator/payments/confirm", getAppUrl(request));
  url.searchParams.set("token", token);
  return NextResponse.json({ qr_url: url.toString(), expires_in_seconds: 300 });
}
