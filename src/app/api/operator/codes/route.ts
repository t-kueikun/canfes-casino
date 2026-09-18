import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseRouteClient, getSupabaseServiceClient, resolveRouteAuth } from "@/lib/supabaseRoute";
import { getAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

async function requireOperator(request: Request) {
  const client = await getSupabaseRouteClient(request);
  const { user } = await resolveRouteAuth(request, client);
  return user;
}

function createCode() {
  return randomBytes(9).toString("hex").toUpperCase();
}

function formatDatabaseError(error: any) {
  if (error?.code === "42P01" && String(error.message).includes("canfes_access_codes")) {
    return "接続先のSupabaseにCanfes用テーブルがありません。管理者に設定を確認してください。";
  }
  return error?.message ?? "QRコードの発行に失敗しました";
}

export async function GET(request: Request) {
  const user = await requireOperator(request);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  const admin = getSupabaseServiceClient() as any;
  const { data, error } = await admin
    .from("canfes_access_codes")
    .select("id, code, initial_amount, created_at, used_at, reusable")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: formatDatabaseError(error) }, { status: 500 });
  const appUrl = getAppUrl(request);
  return NextResponse.json({
    data: (data ?? []).map((item: any) => ({
      ...item,
      qr_url: `${appUrl}/guest?code=${encodeURIComponent(item.code)}`,
    })),
  });
}

export async function POST(request: Request) {
  const user = await requireOperator(request);
  if (!user) return NextResponse.json({ error: "運営ログインが必要です" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { initialAmount?: number };
  const initialAmount = Number.isFinite(Number(body.initialAmount))
    ? Math.max(0, Math.min(100000, Math.floor(Number(body.initialAmount))))
    : 300;
  const admin = getSupabaseServiceClient() as any;
  const { data: existing, error: existingError } = await admin
    .from("canfes_access_codes")
    .select("id, code, initial_amount, created_at, used_at, reusable")
    .eq("created_by", user.id)
    .eq("reusable", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: formatDatabaseError(existingError) }, { status: 500 });
  if (existing) {
    const appUrl = getAppUrl(request);
    return NextResponse.json({
      code: existing.code,
      initial_amount: existing.initial_amount,
      created_at: existing.created_at,
      qr_url: `${appUrl}/guest?code=${encodeURIComponent(existing.code)}`,
      reused: true,
    });
  }

  let data: any = null;
  let error: any = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await admin.from("canfes_access_codes").insert({
      code: createCode(),
      initial_amount: initialAmount,
      created_by: user.id,
      reusable: true,
    }).select("id, code, initial_amount, created_at, used_at, reusable").single();
    data = result.data;
    error = result.error;
    if (!error) break;
  }
  if (error || !data) return NextResponse.json({ error: formatDatabaseError(error) }, { status: 500 });

  const appUrl = getAppUrl(request);
  return NextResponse.json({
    code: data.code,
    initial_amount: data.initial_amount,
    created_at: data.created_at,
    qr_url: `${appUrl}/guest?code=${encodeURIComponent(data.code)}`,
    reused: false,
  }, { status: 201 });
}
