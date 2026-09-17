"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNavigationBar from "../../components/BottomNavigationBar";
import styles from "./page.module.css";

type PaymentMode = "purchase" | "refund";
type Account = { display_name: string };
type PaymentResult = { completed: boolean; balance: number; amount: number; mode: PaymentMode; display_name: string };
type RefundInfo = { amount: number; mode: "refund"; expires_at: string };

export default function PaymentPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [amount, setAmount] = useState(100);
  const [balance, setBalance] = useState<number | null>(null);
  const [mode, setMode] = useState<PaymentMode>("purchase");
  const [refundToken, setRefundToken] = useState("");
  const [refundInfo, setRefundInfo] = useState<RefundInfo | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryMode = params.get("mode");
    const token = params.get("token") ?? "";
    if (token) setMode("refund");
    if (token) setRefundToken(token);

    fetch("/api/guest/account", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { router.replace("/guest"); return; }
      if (!response.ok) return;
      const body = await response.json() as { account: Account; balance: number };
      setAccount(body.account);
      setBalance(body.balance);
      if (token) {
        const refundResponse = await fetch(`/api/guest/payments?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const refundBody = await refundResponse.json().catch(() => ({})) as { payment?: RefundInfo; error?: string };
        if (!refundResponse.ok || !refundBody.payment) {
          setError(refundBody.error ?? "払い戻しQRを確認できませんでした。");
          return;
        }
        setRefundInfo(refundBody.payment);
        setAmount(refundBody.payment.amount);
      } else {
        setAmount(queryMode === "refund" ? body.balance : Math.min(100, body.balance || 100));
      }
    }).catch(() => setError("アカウント情報を読み込めませんでした。電波を確認してください。"));
  }, [router]);

  const changeMode = (nextMode: PaymentMode) => {
    if (refundToken) return;
    setMode(nextMode);
    setResult(null);
    setError("");
    setAmount(nextMode === "refund" ? balance ?? 0 : Math.min(100, balance || 100));
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("mode", nextMode);
    window.history.replaceState(null, "", nextUrl);
  };

  const submitPayment = async () => {
    const safeAmount = Math.floor(amount);
    if (!Number.isInteger(safeAmount) || safeAmount < 1 || safeAmount > 100000) {
      setError("金額は1〜100,000 CFで入力してください。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/guest/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: safeAmount, mode, ...(refundToken ? { token: refundToken } : {}) }),
      });
      if (response.status === 401) { router.replace("/guest"); return; }
      const body = await response.json().catch(() => ({})) as PaymentResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "支払いを確定できませんでした。");
      setResult(body);
      setBalance(body.balance);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "支払いを確定できませんでした。");
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
          <p className={styles.copy}>{account ? `${account.display_name}さんのチップ取引です。` : "運営が提示するQRを読み取り、この画面を開いてください。"}</p>
        </section>

        <section className={styles.card} aria-label="取引内容">
          {!refundToken ? <div className={styles.modeSwitch} role="group" aria-label="取引の種類">
            <button type="button" className={mode === "purchase" ? styles.modeActive : styles.modeButton} onClick={() => changeMode("purchase")}>チップ購入</button>
            <span className={styles.modeDisabled}>払い戻しは運営QR</span>
          </div> : <p className={styles.refundBanner}>運営から提示された払い戻しQR</p>}

          {mode === "refund" ? <div className={styles.balanceLine}><span>現在の残高</span><strong>{balance === null ? "…" : `${balance.toLocaleString()} CF`}</strong></div> : null}

          {!result ? <>
            <label className={styles.amountLabel} htmlFor="chip-amount">{mode === "purchase" ? "購入するチップ" : "受け取るチップ"}<span>CF</span></label>
            <div className={styles.amountInputWrap}><input id="chip-amount" type="number" min={1} max={100000} step={1} inputMode="numeric" value={amount} readOnly={Boolean(refundToken)} onChange={(event) => setAmount(Number(event.target.value))} /><span>CF</span></div>
            {mode === "purchase" ? <p className={styles.helper}>入力したチップ数分、あなたのCF残高から減ります。</p> : <p className={styles.helper}>運営が発行したQRのチップ数を受け取ります。</p>}
            {refundInfo ? <p className={styles.expiry}>この払い戻しQRは10分間有効です。</p> : null}
            <button className={styles.primaryButton} type="button" onClick={() => void submitPayment()} disabled={loading}>
              {loading ? "処理中…" : mode === "refund" ? "受け取る" : "支払う"}
            </button>
          </> : <div className={styles.qrResult}>
            <p className={styles.qrKicker}>{result.mode === "purchase" ? "チップ購入完了" : "払い戻し完了"}</p>
            <strong className={styles.qrAmount}>{result.mode === "purchase" ? "支払いました" : "受け取りました"}</strong>
            <p className={styles.qrInstruction}>{result.amount.toLocaleString()} CFの{result.mode === "purchase" ? "購入" : "払い戻し"}を記録しました。</p>
            <p className={styles.qrInstruction}>現在の残高: {result.balance.toLocaleString()} CF</p>
            <button className={styles.secondaryButton} type="button" onClick={() => { setResult(null); setError(""); }}>続けて取引する</button>
          </div>}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </section>
        <p className={styles.footerNote}>チップ購入ではCFが減り、運営の払い戻しQRを読み取るとCFが増えます。</p>
      </main>
      <div className={styles.footer}><BottomNavigationBar /></div>
    </div>
  );
}
