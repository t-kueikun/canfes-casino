import { createHmac, timingSafeEqual } from "node:crypto";

export type PaymentQrPayload = {
  type: "payment";
  requestId: string;
  accountId: string;
  amount: number;
  mode: "purchase" | "refund";
  expiresAt: number;
};

export type RewardQrPayload = {
  type: "reward";
  accountId: string;
  threshold: 1000 | 3000;
  expiresAt: number;
};

export type QrPayload = PaymentQrPayload | RewardQrPayload;

function getSigningKey() {
  const secret = process.env.CANFES_QR_SIGNING_SECRET
    ?? process.env.CANFES_SUPABASE_SECRET_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("CANFES_QR_SIGNING_SECRET is not configured");
  return createHmac("sha256", secret).update("canfes-qr-v1").digest();
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getSigningKey()).update(encodedPayload).digest("base64url");
}

export function createQrToken(payload: QrPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function readQrToken(value: unknown): QrPayload | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  const [encodedPayload, suppliedSignature, extra] = value.split(".");
  if (!encodedPayload || !suppliedSignature || extra) return null;

  let expectedSignature: Buffer;
  let actualSignature: Buffer;
  try {
    expectedSignature = Buffer.from(sign(encodedPayload), "base64url");
    actualSignature = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return null;
  }
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<QrPayload>;
    if (typeof payload.expiresAt !== "number" || !Number.isInteger(payload.expiresAt)) return null;
    if (payload.type === "payment") {
      if (
        typeof payload.requestId !== "string"
        || typeof payload.accountId !== "string"
        || !Number.isInteger(payload.amount)
        || Number(payload.amount) < 1
        || Number(payload.amount) > 100000
        || (payload.mode !== "purchase" && payload.mode !== "refund")
      ) return null;
      return payload as PaymentQrPayload;
    }
    if (payload.type === "reward") {
      if (typeof payload.accountId !== "string" || (payload.threshold !== 1000 && payload.threshold !== 3000)) return null;
      return payload as RewardQrPayload;
    }
  } catch {
    return null;
  }
  return null;
}
