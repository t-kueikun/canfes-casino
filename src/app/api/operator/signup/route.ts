import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const dynamic = "force-dynamic";

function getAuthRedirectUrl(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_CANFES_APP_URL?.trim();
  const baseUrl = appUrl || new URL(request.url).origin;
  return new URL("/operator/login", baseUrl).toString();
}

export async function POST(request: Request) {
  const invitePassword = process.env.CANFES_OPERATOR_INVITE_PASSWORD?.trim();
  if (!invitePassword) {
    return NextResponse.json(
      { error: "運営アカウント作成用の招待パスワードが設定されていません" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({})) as {
    email?: string;
    password?: string;
    invitePassword?: string;
  };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const providedInvitePassword = typeof body.invitePassword === "string" ? body.invitePassword : "";

  if (!email || !password || !providedInvitePassword) {
    return NextResponse.json({ error: "入力項目をすべて入力してください" }, { status: 400 });
  }
  if (providedInvitePassword !== invitePassword) {
    return NextResponse.json({ error: "運営アカウント作成用パスワードが違います" }, { status: 403 });
  }

  const supabase = await getSupabaseRouteClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(request),
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    requiresEmailConfirmation: !data.session,
    session: data.session
      ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }
      : null,
  }, { status: 201 });
}
