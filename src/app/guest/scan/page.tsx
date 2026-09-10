"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../page.module.css";

type QrReader = {
  start: (
    camera: { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number }; aspectRatio?: number },
    onSuccess: (decodedText: string) => void,
    onError: (error: string) => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  scanFile: (file: File, showImage: boolean) => Promise<string>;
};

function extractCode(raw: string) {
  const value = raw.trim();
  try {
    const url = new URL(value, window.location.origin);
    return url.searchParams.get("code")?.trim() || value;
  } catch {
    return value;
  }
}

function GuestScan() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scannerRef = useRef<QrReader | null>(null);
  const displayNameRef = useRef("");
  const loadingRef = useRef(false);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active">("idle");
  const [cameraError, setCameraError] = useState("");
  const [message, setMessage] = useState("");

  const claimCode = useCallback(async (rawCode: string) => {
    const code = extractCode(rawCode);
    if (!code || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/guest/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, displayName: displayNameRef.current }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "このQRコードは利用できません。運営に確認してください。");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setMessage("通信に失敗しました。電波を確認して、もう一度お試しください。");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) void claimCode(code);
  }, [claimCode, searchParams]);

  useEffect(() => {
    let cancelled = false;
    const setupReader = async () => {
      const { Html5Qrcode } = require("html5-qrcode") as {
        Html5Qrcode: new (elementId: string, verbose?: boolean) => QrReader;
      };
      if (!cancelled) scannerRef.current = new Html5Qrcode("canfes-guest-qr-reader", false);
    };
    void setupReader();

    return () => {
      cancelled = true;
      const reader = scannerRef.current;
      scannerRef.current = null;
      if (reader) {
        void reader.stop().catch(() => undefined).finally(() => {
          try { reader.clear(); } catch { /* reader was already cleared */ }
        });
      }
    };
  }, []);

  const startCamera = async () => {
    const reader = scannerRef.current;
    if (!reader || cameraState === "starting" || cameraState === "active") return;
    setCameraState("starting");
    setCameraError("");
    try {
      await reader.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        (decodedText) => void claimCode(decodedText),
        () => undefined,
      );
      setCameraState("active");
    } catch {
      setCameraState("idle");
      setCameraError("カメラを起動できませんでした。ブラウザのカメラ権限を許可してから、もう一度お試しください。");
    }
  };

  const stopCamera = async () => {
    const reader = scannerRef.current;
    if (!reader || cameraState !== "active") return;
    await reader.stop().catch(() => undefined);
    setCameraState("idle");
  };

  const scanImage = async (file: File) => {
    const reader = scannerRef.current;
    if (!reader || loadingRef.current) return;
    setCameraError("");
    setMessage("");
    try {
      const decodedText = await reader.scanFile(file, true);
      void claimCode(decodedText);
    } catch {
      setMessage("QRコードを読み取れませんでした。画像を確認して、もう一度お試しください。");
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.entryCard} aria-labelledby="guest-scan-title">
        <a className={styles.backLink} href="/guest">← 参加者入口に戻る</a>
        <div className={styles.heroCopyCompact}>
          <p className={styles.eyebrow}>STEP 1 / 2</p>
          <h1 id="guest-scan-title">QRコードを<br /><span>読み取る</span></h1>
          <p className={styles.lead}>運営から受け取ったQRコードをカメラに映してください。</p>
        </div>

        <div className={styles.entryForm}>
          <label className={styles.nameField}>
            <span>表示名 <em>任意</em></span>
            <input
              value={displayName}
              onChange={(event) => {
                displayNameRef.current = event.target.value;
                setDisplayName(event.target.value);
              }}
              maxLength={40}
              placeholder="会場で表示する名前"
              autoComplete="nickname"
            />
          </label>

          <div className={styles.scannerPanel}>
            <div id="canfes-guest-qr-reader" className={styles.scanReader} aria-label="QRコード読み取り画面" />
            <div className={styles.scannerActions}>
              {cameraState === "active" ? (
                <button className={styles.secondaryButton} onClick={() => void stopCamera()} type="button">カメラを停止</button>
              ) : (
                <button className={styles.primaryButton} onClick={() => void startCamera()} disabled={cameraState === "starting" || loading} type="button">
                  {cameraState === "starting" ? "カメラを起動しています…" : "カメラを起動する"}
                </button>
              )}
              <label className={styles.imageButton}>
                QR画像から読み取る
                <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void scanImage(file); event.currentTarget.value = ""; }} />
              </label>
            </div>
          </div>

          {cameraError ? <p className={styles.errorMessage} role="alert">{cameraError}</p> : null}
          {loading ? <p className={styles.statusMessage} aria-live="polite">参加登録を確認しています…</p> : null}
          {message ? <p className={styles.errorMessage} role="alert">{message}</p> : null}
        </div>

        <p className={styles.privacyNote}>カメラはQRコードの読み取りにのみ使用します</p>
      </section>
    </main>
  );
}

export default function GuestScanPage() {
  return (
    <Suspense fallback={<main className={styles.loadingPage}>読み込み中…</main>}>
      <GuestScan />
    </Suspense>
  );
}
