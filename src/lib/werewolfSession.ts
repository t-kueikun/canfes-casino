import { createHash, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";

export const WEREWOLF_VOTER_COOKIE = "canfes_werewolf_voter";
const VOTER_MAX_AGE = 60 * 60 * 24 * 30;

export function createWerewolfVoterToken() {
  return randomBytes(32).toString("base64url");
}

export function hashWerewolfVoterToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readWerewolfVoterToken(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${WEREWOLF_VOTER_COOKIE}=`));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(WEREWOLF_VOTER_COOKIE.length + 1)) || null;
  } catch {
    return null;
  }
}

export function setWerewolfVoterCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: WEREWOLF_VOTER_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VOTER_MAX_AGE,
  });
}
