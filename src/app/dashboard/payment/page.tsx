"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNavigationBar from "../../components/BottomNavigationBar";
import styles from "./page.module.css";

type PaymentMode = "purchase" | "refund";
type Account = { display_name: string };
type QrRequest = { qr_url: string; expires_in_seconds: number };

export default function PaymentPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [amount, setAmount] = useState(100);
  const [balance, setBalance] = useState<number | null>(null);
  const [mode, setMode] = useState<PaymentMode>("purchase");
  const [qrRequest, setQrRequest] = useState<QrRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const queryMode = new URLSearchParams(window.location.search).get("mode");
    if (queryMode === "refund") setMode("refund");

    fetch("/api/guest/account", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { router.replace("/guest"); return; }
      if (!response.ok) return;
      const body = await response.json() as { account: Account; balance: number };
      setAccount(body.account);
      setBalance(body.balance);
      setAmount(queryMode === "refund" ? body.balance : Math.min(100, body.balance || 100));
    }).catch(() => setError("アカウント情報を読み込めませんでした。電波を確認してください。"));
  }, [router]);

  const changeMode = (nextMode: PaymentMode) => {
    setMode(nextMode);
    setQrRequest(null);
    setError("");
    setAmount(nextMode === "refund" ? balance ?? 0 : Math.min(100, balance || 100));
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("mode", nextMode);
    window.history.replaceState(null, "", nextUrl);
  };

  const createQr = async () => {
    const safeAmount = Math.floor(amount);
    if (!Number.isInteger(safeAmount) || safeAmount < 1 || safeAmount > 100000) {
      setError("金額は1〜100,000 CFで入力してください。");
      return;
    }
    if (mode === "refund" && safeAmount > (balance ?? 0)) {
      setError("払い戻し額が現在の残高を超えています。");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/guest/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: safeAmount, mode }),
      });
      if (response.status === 401) { router.replace("/guest"); return; }
      const body = await response.json().catch(() => ({})) as QrRequest & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "QRコードを作成できませんでした。");
      setQrRequest(body);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "QRコードを作成できませんでした。");
    } finally {
      setLoading(false);
    }
  };

  const label = mode === "purchase" ? "チップ購入" : "チップ払い戻し";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}><Link className={styles.backLink} href="/dashboard">← ホーム</Link><span className={styles.headerLabel}>CF TRANSACTIONS</span></header>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>爆裂カジノ / PARTICIPANT</p>
          <h1>{label}</h1>
          <p className={styles.copy}>{account ? `${account.display_name}さんのチップ取引です。` : "スタッフが提示するQRを読み取り、この画面を開いてください。"}</p>
        </section>

        <section className={styles.card} aria-label="取引内容">
          <div className={styles.modeSwitch} role="group" aria-label="取引の種類">
            <button type="button" className={mode === "purchase" ? styles.modeActive : styles.modeButton} onClick={() => changeMode("purchase")}>チップ購入</button>
            <button type="button" className={mode === "refund" ? styles.modeActive : styles.modeButton} onClick={() => changeMode("refund")}>払い戻し</button>
          </div>

          {mode === "refund" ? <div className={styles.balanceLine}><span>現在の残高</span><strong>{balance === null ? "…" : `${balance.toLocaleString()} CF`}</strong></div> : null}

          {!qrRequest ? <>
            <label className={styles.amountLabel} htmlFor="chip-amount">{mode === "purchase" ? "購入するチップ" : "払い戻すチップ"}<span>CF</span></label>
            <div className={styles.amountInputWrap}><input id="chip-amount" type="number" min={1} max={mode === "refund" ? balance ?? 0 : 100000} step={1} inputMode="numeric" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><span>CF</span></div>
            {mode === "purchase" ? <p className={styles.helper}>スタッフの案内に沿ってチップ数を入力してください。</p> : <p className={styles.helper}>払い戻しできる上限は現在の残高です。現金の受け取り額はスタッフにご確認ください。</p>}
            <button className={styles.primaryButton} type="button" onClick={() => void createQr()} disabled={loading || (mode === "refund" && (balance === null || balance < 1))}>
              {loading ? "QRコードを作成中…" : "スタッフに見せるQRを表示"}
            </button>
          </> : <div className={styles.qrResult}>
            <p className={styles.qrKicker}>{mode === "purchase" ? "購入内容を提示" : "払い戻し内容を提示"}</p>
            <strong className={styles.qrAmount}>{amount.toLocaleString()} <small>CF</small></strong>
            <div className={styles.qrFrame}><QRCodeCanvas value={qrRequest.qr_url} size={240} includeMargin level="M" /></div>
            <p className={styles.qrInstruction}>このQRをスタッフに読み取ってもらってください。現金の受け渡し後、スタッフが確定すると残高と履歴が更新されます。</p>
            <p className={styles.expiry}>このQRは5分間有効です。</p>
            <button className={styles.secondaryButton} type="button" onClick={() => setQrRequest(null)}>金額を変更する</button>
          </div>}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </section>
        <p className={styles.footerNote}>チップ購入ではCFが加算され、払い戻しでは確定後にCFが差し引かれます。</p>
      </main>
      <div className={styles.footer}><BottomNavigationBar /></div>
    </div>
  );
}
