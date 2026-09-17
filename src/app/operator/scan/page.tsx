"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./page.module.css";

type QrReader = {
  start: (camera: { facingMode: string }, config: { fps: number; qrbox: { width: number; height: number }; aspectRatio?: number }, onSuccess: (text: string) => void, onError: (error: string) => void) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  scanFile: (file: File, showImage: boolean) => Promise<string>;
};

async function stopReaderIfActive(reader: QrReader | null, cameraActiveRef: { current: boolean }) {
  if (!reader || !cameraActiveRef.current) return;
  // Clear the flag before awaiting stop so route cleanup cannot stop twice.
  cameraActiveRef.current = false;
  await reader.stop().catch(() => undefined);
}

export default function OperatorScanPage() {
  const router = useRouter();
  const readerRef = useRef<QrReader | null>(null);
  const cameraActiveRef = useRef(false);
  const startTaskRef = useRef<Promise<void> | null>(null);
  const disposedRef = useRef(false);
  const handledRef = useRef(false);
  const [authReady, setAuthReady] = useState(false);
  const [readerReady, setReaderReady] = useState(false);
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      if (!user) {
        router.replace(`/operator/login?next=${encodeURIComponent("/operator/scan")}`);
        return;
      }
      setAuthReady(true);
    });
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!authReady) return;
    const { Html5Qrcode } = require("html5-qrcode") as { Html5Qrcode: new (elementId: string, verbose?: boolean) => QrReader };
    const reader = new Html5Qrcode("canfes-operator-qr-reader", false);
    disposedRef.current = false;
    readerRef.current = reader;
    setReaderReady(true);
    return () => {
      disposedRef.current = true;
      const startTask = startTaskRef.current;
      readerRef.current = null;
      void (async () => {
        await startTask?.catch(() => undefined);
        await stopReaderIfActive(reader, cameraActiveRef);
        try { reader.clear(); } catch { /* reader already cleared */ }
      })();
    };
  }, [authReady]);

  const acceptQr = async (raw: string) => {
    if (handledRef.current) return;
    let target = "";
    try {
      const url = new URL(raw.trim(), window.location.origin);
      if (url.origin === window.location.origin) {
        if (url.pathname === "/operator/payments/confirm" && url.searchParams.get("token")) target = `${url.pathname}?token=${encodeURIComponent(url.searchParams.get("token")!)}`;
        if (url.pathname === "/rewards/redeem" && url.searchParams.get("token")) target = `${url.pathname}?token=${encodeURIComponent(url.searchParams.get("token")!)}`;
      }
    } catch { /* invalid QR content */ }
    if (!target) {
      setError("参加者の購入・払戻しQR、または景品受け取りQRを読み取ってください。");
      return;
    }
    handledRef.current = true;
    setError("");
    await stopReaderIfActive(readerRef.current, cameraActiveRef);
    router.push(target);
  };

  const startCamera = async () => {
    const reader = readerRef.current;
    if (!reader || cameraState !== "idle") return;
    setError("");
    setCameraState("starting");
    const startTask = (async () => {
      try {
        await reader.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 }, (text) => void acceptQr(text), () => undefined);
        cameraActiveRef.current = true;
        if (disposedRef.current) {
          await stopReaderIfActive(reader, cameraActiveRef);
          return;
        }
        setCameraState("active");
      } catch {
        if (!disposedRef.current) {
          setCameraState("idle");
          setError("カメラを起動できませんでした。ブラウザでカメラの使用を許可してください。");
        }
      }
    })();
    startTaskRef.current = startTask;
    await startTask;
    if (startTaskRef.current === startTask) startTaskRef.current = null;
  };

  const stopCamera = async () => {
    await stopReaderIfActive(readerRef.current, cameraActiveRef);
    setCameraState("idle");
  };

  const scanImage = async (file: File) => {
    setError("");
    try {
      const text = await readerRef.current?.scanFile(file, true);
      if (text) await acceptQr(text);
    } catch {
      setError("QRを読み取れませんでした。画像を確認して、もう一度お試しください。");
    }
  };

  if (!authReady) return <main className={styles.loading}>運営ログインを確認しています…</main>;

  return (
    <main className={styles.page}>
      <header className={styles.topbar}><Link href="/operator" className={styles.brand}><span className={styles.brandMark}>爆</span><span><strong>爆裂カジノ</strong><small>OPERATOR</small></span></Link><Link href="/operator" className={styles.back}>運営トップへ</Link></header>
      <section className={styles.card}>
        <p className={styles.eyebrow}>STAFF QR SCANNER</p>
        <h1>参加者のQRを<br /><span>読み取る</span></h1>
        <p className={styles.copy}>購入・払戻しは現金の受け渡し確認へ、景品QRは受け取り確認へ進みます。</p>
        <div id="canfes-operator-qr-reader" className={styles.reader} aria-label="参加者QRコード読み取り画面" />
        {cameraState === "active" ? <button className={styles.secondaryButton} type="button" onClick={() => void stopCamera()}>カメラを停止</button> : <button className={styles.primaryButton} type="button" disabled={!readerReady || cameraState === "starting"} onClick={() => void startCamera()}>{cameraState === "starting" ? "カメラを起動しています…" : readerReady ? "カメラを起動する" : "読み取り画面を準備中…"}</button>}
        <label className={styles.imageButton}>QR画像から読み取る<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void scanImage(file); event.currentTarget.value = ""; }} /></label>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <p className={styles.note}>参加者のQRを読み取った後、受け渡しを確認して確定してください。</p>
      </section>
    </main>
  );
}
