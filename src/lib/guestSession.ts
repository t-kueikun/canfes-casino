import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseRoute";

export const GUEST_SESSION_COOKIE = "canfes_guest_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type GuestAccount = {
  id: string;
  display_name: string;
  active: boolean;
  created_at: string;
};

export function createGuestSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashGuestSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function readToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const bearer = authorization.slice(7).trim();
    if (bearer) return bearer;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GUEST_SESSION_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.slice(GUEST_SESSION_COOKIE.length + 1)) : null;
}

export async function resolveGuestAccount(request: Request) {
  const token = readToken(request);
  if (!token) return null;

  const admin = getSupabaseServiceClient() as any;
  const { data, error } = await admin
    .from("canfes_accounts")
    .select("id, display_name, active, created_at")
    .eq("session_token_hash", hashGuestSessionToken(token))
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return null;

  void admin
    .from("canfes_accounts")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return data as GuestAccount;
}

export function setGuestSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: GUEST_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export function clearGuestSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: GUEST_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
