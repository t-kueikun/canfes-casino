"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";
import BottomNavigationBar from "../../components/BottomNavigationBar";
import styles from "./page.module.css";

type Reward = {
  threshold: 1000 | 3000;
  eligible: boolean;
  claimed: boolean;
  reward_name: string;
  claimed_at: string | null;
};
type RewardsResponse = {
  account: { display_name: string };
  balance: number;
  peak_amount: number;
  rewards: Reward[];
};
type RewardQr = { threshold: number; url: string };

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function RewardsPage() {
  const router = useRouter();
  const [data, setData] = useState<RewardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<RewardQr | null>(null);
  const [creatingQr, setCreatingQr] = useState<number | null>(null);

  const loadRewards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/guest/rewards", { cache: "no-store" });
      if (response.status === 401) { router.replace("/guest"); return; }
      const body = await response.json().catch(() => ({})) as RewardsResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "景品情報を読み込めませんでした");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "景品情報を読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void loadRewards(); }, [loadRewards]);

  const showRewardQr = async (reward: Reward) => {
    setCreatingQr(reward.threshold);
    setError(null);
    try {
      const response = await fetch("/api/guest/rewards/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold: reward.threshold }),
      });
      if (response.status === 401) { router.replace("/guest"); return; }
      const body = await response.json().catch(() => ({})) as { qr_url?: string; error?: string };
      if (!response.ok || !body.qr_url) throw new Error(body.error ?? "受け取り用QRを作成できませんでした");
      setQr({ threshold: reward.threshold, url: body.qr_url });
    } catch (qrError) {
      setError(qrError instanceof Error ? qrError.message : "受け取り用QRを作成できませんでした");
    } finally {
      setCreatingQr(null);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <Link className={styles.backLink} href="/dashboard">← ホーム</Link>
          <span className={styles.headerLabel}>REWARDS</span>
        </header>

        <section className={styles.intro}>
          <p className={styles.eyebrow}>爆裂カジノ / PARTICIPANT</p>
          <h1>{data?.account.display_name ?? "参加者"}さんの<br /><span>景品受け取り</span></h1>
          <p className={styles.copy}>到達した景品のQRをスタッフに読み取ってもらうと、受け取りを記録できます。</p>
        </section>

        {error ? <div className={styles.error} role="alert">{error}</div> : null}

        <section className={styles.balanceCard} aria-label="チップ状況">
          <div><span>現在のチップ</span><strong>{loading ? "…" : `${(data?.balance ?? 0).toLocaleString()} CF`}</strong></div>
          <div><span>過去最高</span><strong>{loading ? "…" : `${(data?.peak_amount ?? 0).toLocaleString()} CF`}</strong></div>
        </section>

        <section className={styles.rewardSection} aria-labelledby="reward-list-title">
          <div className={styles.sectionHeader}><div><span className={styles.sectionKicker}>REWARD MILESTONES</span><h2 id="reward-list-title">到達景品</h2></div><span className={styles.noDeduction}>チップは減りません</span></div>
          {loading ? <p className={styles.state}>景品情報を読み込んでいます…</p> : error ? null : <div className={styles.rewardList}>{(data?.rewards ?? []).map((reward) => <article key={reward.threshold} className={`${styles.rewardCard} ${reward.claimed ? styles.rewardCardClaimed : reward.eligible ? styles.rewardCardEligible : ""}`}>
            <div className={styles.rewardTop}><span className={styles.threshold}>{reward.threshold.toLocaleString()}<small> CF</small></span><span className={reward.claimed ? styles.claimedBadge : reward.eligible ? styles.eligibleBadge : styles.lockedBadge}>{reward.claimed ? "受け取り済み" : reward.eligible ? "受け取り対象" : "未到達"}</span></div>
            <h3>{reward.reward_name}</h3>
            {reward.claimed ? <p>スタッフによる受け取り処理済みです。<br />{formatDate(reward.claimed_at)}に記録されています。</p> : reward.eligible ? <>
              <p className={styles.readyCopy}>景品を受け取るときに、スタッフへこのQRを提示してください。</p>
              <button className={styles.rewardQrButton} type="button" onClick={() => void showRewardQr(reward)} disabled={creatingQr === reward.threshold}>{creatingQr === reward.threshold ? "QRを作成中…" : qr?.threshold === reward.threshold ? "QRを更新する" : "受け取り用QRを表示"}</button>
              {qr?.threshold === reward.threshold ? <div className={styles.rewardQrPanel}>
                <div className={styles.rewardQr}><QRCodeCanvas value={qr.url} size={220} includeMargin level="M" /></div>
                <p>スタッフのiPhoneカメラで読み取ってもらってください。QRは10分間有効です。</p>
                <button className={styles.dismissQr} type="button" onClick={() => setQr(null)}>QRを閉じる</button>
              </div> : null}
            </> : <p>過去最高 <strong>{(data?.peak_amount ?? 0).toLocaleString()} CF</strong> / あと <strong>{Math.max(0, reward.threshold - (data?.peak_amount ?? 0)).toLocaleString()} CF</strong></p>}
          </article>)}</div>}
        </section>

        <div className={styles.note}><strong>景品受け取りについて</strong><p>景品を受け取っても、チップ残高はそのまま維持されます。同じ到達額の景品は1回のみ受け取れます。</p></div>
      </main>
      <div className={styles.footer}><BottomNavigationBar /></div>
    </div>
  );
}
