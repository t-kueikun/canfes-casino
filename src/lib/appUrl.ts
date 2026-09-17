const PRODUCTION_APP_URL = "https://canfes-casino.vercel.app";

function isNgrokUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname.endsWith(".ngrok-free.dev") || hostname.endsWith(".ngrok.app") || hostname.endsWith(".ngrok.io");
  } catch {
    return false;
  }
}

export function getAppUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_CANFES_APP_URL?.trim().replace(/\/+$/, "");
  if (configuredUrl && !isNgrokUrl(configuredUrl)) return configuredUrl;

  const requestOrigin = new URL(request.url).origin;
  if (process.env.VERCEL || requestOrigin.includes("vercel.app")) return requestOrigin;

  return PRODUCTION_APP_URL;
}
