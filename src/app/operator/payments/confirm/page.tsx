"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "../page.module.css";

type PaymentInfo = { mode: "purchase" | "refund"; amount: number; display_name: string; expires_at: string; completed: boolean };
type Result = { already_completed: boolean; balance: number; amount: number; mode: "purchase" | "refund"; display_name: string };

function PaymentConfirmation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  }, []);

  const loadPayment = useCallback(async () => {
    if (!token) { setError("QRコードに取引情報がありません。"); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/operator/payments?token=${encodeURIComponent(token)}`, { cache: "no-store", headers: await authHeaders() });
      if (response.status === 401) { router.replace("/operator/login"); return; }
      const body = await response.json().catch(() => ({})) as { payment?: PaymentInfo; error?: string };
      if (!response.ok) throw new Error(body.error ?? "取引情報を確認できませんでした。");
      setPayment(body.payment ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "取引情報を確認できませんでした。");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, router, token]);

  useEffect(() => {
    getSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace(`/operator/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
      else void loadPayment();
    });
  }, [loadPayment, router]);

  const confirmPayment = async () => {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/operator/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ token }),
      });
      if (response.status === 401) { router.replace("/operator/login"); return; }
      const body = await response.json().catch(() => ({})) as Result & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "取引を確定できませんでした。");
      setResult(body);
      setPayment((current) => current ? { ...current, completed: true } : current);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "取引を確定できませんでした。");
    } finally {
      setSubmitting(false);
    }
  };

  const mode = payment?.mode ?? result?.mode;
  const label = mode === "refund" ? "払い戻し" : "チップ購入";

  return (
    <div className={styles.page}>
      <main className={styles.confirmMain}>
        <header className={styles.topbar}><Link className={styles.brand} href="/operator"><span className={styles.brandMark}>爆</span><span><strong>爆裂カジノ</strong><small>OPERATOR</small></span></Link><Link className={styles.backLink} href="/operator/scan">次のQRを読み取る</Link></header>
        <section className={styles.confirmCard}>
          <p className={styles.eyebrow}>TRANSACTION CONFIRMATION</p>
          {loading ? <h1>取引を確認しています…</h1> : result ? <>
            <div className={styles.doneMark}>✓</div>
            <h1>{result.already_completed ? "処理済みの取引です" : "取引を確定しました"}</h1>
            <p className={styles.confirmCopy}>{result.display_name}さんの{result.amount.toLocaleString()} CF {result.mode === "purchase" ? "購入" : "払い戻し"}を記録しました。</p>
            <div className={styles.balanceResult}>現在の残高 <strong>{result.balance.toLocaleString()} CF</strong></div>
          </> : error ? <>
            <h1>QR取引の確認</h1>
            <p className={styles.error} role="alert">{error}</p>
            <button className={styles.secondaryButton} type="button" onClick={() => void loadPayment()}>もう一度確認</button>
          </> : payment ? <>
            <h1>{label}</h1>
            <dl className={styles.details}><div><dt>参加者</dt><dd>{payment.display_name}さん</dd></div><div><dt>金額</dt><dd>{payment.amount.toLocaleString()} CF</dd></div><div><dt>取引内容</dt><dd>{payment.mode === "purchase" ? "残高からCFを差し引き" : "残高にCFを加算"}</dd></div></dl>
            {payment.completed ? <p className={styles.notice}>このQRの取引はすでに確定しています。</p> : <>
              <p className={styles.confirmCopy}>{payment.mode === "purchase" ? "現金を受け取った後に確定してください。" : "現金を渡した後に確定してください。"}</p>
              <button className={styles.primaryButton} type="button" onClick={() => void confirmPayment()} disabled={submitting}>{submitting ? "処理しています…" : "現金の受け渡しを確認して確定"}</button>
            </>}
          </> : null}
          {!result && !loading && !error && payment ? <p className={styles.expiry}>QR有効期限: {new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(payment.expires_at))}まで</p> : null}
          {error && payment ? <p className={styles.error} role="alert">{error}</p> : null}
        </section>
      </main>
    </div>
  );
}

export default function OperatorPaymentConfirmPage() {
  return <Suspense fallback={<main className={styles.page}><p className={styles.loading}>読み込み中…</p></main>}><PaymentConfirmation /></Suspense>;
}
