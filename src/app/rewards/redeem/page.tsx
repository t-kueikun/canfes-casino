"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./page.module.css";

type RewardClaim = {
  display_name: string;
  threshold: number;
  reward_name: string;
  claimed: boolean;
  claimed_at: string | null;
  eligible: boolean;
};

function RewardRedemption() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [claim, setClaim] = useState<RewardClaim | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  }, []);

  const loadClaim = useCallback(async () => {
    if (!token) { setError("QRコードに受け取り情報がありません。"); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/rewards/redeem?token=${encodeURIComponent(token)}`, { cache: "no-store", headers: await authHeaders() });
      if (response.status === 401) {
        router.replace(`/operator/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
        return;
      }
      const body = await response.json().catch(() => ({})) as RewardClaim & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "景品情報を確認できませんでした。");
      setClaim(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "景品情報を確認できませんでした。");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, router, token]);

  useEffect(() => {
    getSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace(`/operator/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
      else void loadClaim();
    });
  }, [loadClaim, router]);

  const confirmClaim = async () => {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ token }),
      });
      if (response.status === 401) {
        router.replace(`/operator/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
        return;
      }
      const body = await response.json().catch(() => ({})) as RewardClaim & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "受け取りを確定できませんでした。");
      setClaim((current) => current ? { ...current, claimed: true, claimed_at: body.claimed_at } : current);
      setDone(true);
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "受け取りを確定できませんでした。");
      if (claimError instanceof Error && claimError.message.includes("すでに受け取り済み")) void loadClaim();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link className={styles.brand} href="/">爆裂カジノ</Link>
        <p className={styles.eyebrow}>REWARD PICKUP</p>
        {loading ? <h1>景品を確認しています…</h1> : error && !claim ? <><h1>受け取りQR</h1><p className={styles.error} role="alert">{error}</p><button className={styles.secondaryButton} type="button" onClick={() => void loadClaim()}>もう一度確認</button></> : claim ? <>
          {done || claim.claimed ? <span className={styles.doneIcon}>✓</span> : null}
          <h1>{done || claim.claimed ? "景品の受け取り完了" : "景品をお渡しください"}</h1>
          <p className={styles.copy}><strong>{claim.display_name}さん</strong>の受け取りです。</p>
          <div className={styles.rewardBox}><span>{claim.threshold.toLocaleString()} CF到達景品</span><strong>{claim.reward_name}</strong></div>
          {!claim.eligible && !claim.claimed ? <p className={styles.error} role="alert">この景品の到達条件を満たしていません。</p> : null}
          {claim.claimed && !done ? <p className={styles.notice}>この景品はすでに受け取り済みです。</p> : null}
          {!claim.claimed && claim.eligible ? <><p className={styles.copy}>景品をお渡しした後、受け取り済みとして記録してください。</p><button className={styles.primaryButton} type="button" onClick={() => void confirmClaim()} disabled={submitting}>{submitting ? "記録しています…" : "景品を渡して受け取りを確定"}</button></> : null}
          {done || claim.claimed ? <Link className={styles.secondaryButton} href="/operator/scan">次のQRを読み取る</Link> : null}
        </> : null}
        {error && claim ? <p className={styles.error} role="alert">{error}</p> : null}
        <p className={styles.footerNote}>このページを閉じて参加者へお戻しください。</p>
      </section>
    </main>
  );
}

export default function RewardRedeemPage() {
  return <Suspense fallback={<main className={styles.page}><p>読み込み中…</p></main>}><RewardRedemption /></Suspense>;
}
