"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./page.module.css";

type RewardThreshold = 1000 | 3000;
type RewardState = { threshold: RewardThreshold; eligible: boolean; claimed: boolean; reward_name: string | null; claimed_at: string | null };
type Participant = {
  id: string;
  display_name: string;
  active: boolean;
  balance: number;
  peak_amount: number;
  rewards: RewardState[];
  created_at: string;
  last_seen_at: string;
};
type SortMode = "newest" | "balance";

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "日時不明";
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function OperatorAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Participant[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const loadAccounts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/operator/accounts", { cache: "no-store", headers: await authHeaders() });
      if (response.status === 401) { router.replace("/operator/login"); return; }
      const body = await response.json().catch(() => ({})) as { data?: Participant[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "参加者アカウントを読み込めませんでした");
      setAccounts(body.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "参加者アカウントを読み込めませんでした");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  const claimReward = async (account: Participant, reward: RewardState) => {
    const key = `${account.id}:${reward.threshold}`;
    setClaiming(key);
    setNotice(null);
    try {
      const response = await fetch("/api/operator/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ accountId: account.id, threshold: reward.threshold }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (response.status === 401) { router.replace("/operator/login"); return; }
      if (!response.ok) throw new Error(body.error ?? "景品付与に失敗しました");
      setNotice(`${account.display_name}さんに${reward.threshold.toLocaleString()}CF景品を付与済みにしました`);
      await loadAccounts(true);
    } catch (claimError) {
      setNotice(claimError instanceof Error ? claimError.message : "景品付与に失敗しました");
    } finally {
      setClaiming(null);
    }
  };

  useEffect(() => {
    getSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/operator/login");
      else void loadAccounts();
    });
  }, [loadAccounts, router]);

  const visibleAccounts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return accounts
      .filter((account) => !normalized || account.display_name.toLowerCase().includes(normalized) || account.id.toLowerCase().includes(normalized))
      .sort((a, b) => sort === "balance" ? b.balance - a.balance : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [accounts, query, sort]);

  const totalBalance = accounts.reduce((total, account) => total + account.balance, 0);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.topbar}>
          <Link className={styles.brand} href="/operator"><span className={styles.brandMark}>爆</span><span><strong>爆裂カジノ</strong><small>OPERATOR</small></span></Link>
          <div className={styles.topbarActions}><Link className={styles.backLink} href="/operator">運営トップ</Link><button className={styles.logoutButton} type="button" onClick={async () => { await getSupabaseClient().auth.signOut(); router.replace("/operator/login"); }}>ログアウト</button></div>
        </header>

        <header className={styles.header}>
          <div><p className={styles.eyebrow}>PARTICIPANT ACCOUNTS / REWARD CONTROL</p><h1 className={styles.title}>参加者アカウント</h1><p className={styles.copy}>現在の残高と、到達済み景品の付与状況を確認できます。</p></div>
          <Link className={styles.headerLink} href="/operator">← 運営トップへ</Link>
        </header>

        <section className={styles.summary} aria-label="参加者集計">
          <div className={styles.summaryCard}><span>参加者数</span><strong>{accounts.length.toLocaleString()}</strong><small>登録済みアカウント</small></div>
          <div className={styles.summaryCard}><span>保有CF合計</span><strong>{totalBalance.toLocaleString()}</strong><small>全参加者の現在残高</small></div>
        </section>

        <section className={styles.card} aria-labelledby="account-list-title">
          <div className={styles.toolbar}>
            <input className={styles.search} aria-label="参加者を検索" placeholder="名前・アカウントIDで検索" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className={styles.toolbarRight}><select className={styles.select} aria-label="並び順" value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="newest">登録が新しい順</option><option value="balance">残高が多い順</option></select><button className={styles.refreshButton} type="button" onClick={() => void loadAccounts(true)} disabled={loading || refreshing}>{refreshing ? "更新中…" : "更新 ↻"}</button></div>
          </div>
          <h2 id="account-list-title" className={styles.visuallyHidden}>参加者アカウント一覧</h2>
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
          {loading ? <p className={styles.loading}>参加者一覧を読み込んでいます…</p> : error ? <p className={styles.error} role="alert">{error}</p> : visibleAccounts.length === 0 ? <p className={styles.empty}>{query ? "検索に一致する参加者はいません。" : "まだ参加者アカウントがありません。"}</p> : <div className={styles.accountList}>{visibleAccounts.map((account) => <article className={styles.accountRow} key={account.id}><div className={styles.accountIdentity}><strong className={styles.accountName}>{account.display_name || "参加者"}</strong><span className={styles.accountMeta}>登録 {formatDate(account.created_at)} ・ 最終利用 {formatDate(account.last_seen_at)}</span><span className={styles.accountMeta}>ID <code title={account.id}>{account.id}</code></span>{account.active ? <span className={styles.status}>有効</span> : null}<div className={styles.rewardList}>{account.rewards.map((reward) => { const key = `${account.id}:${reward.threshold}`; return <div className={styles.rewardItem} key={reward.threshold}><span className={reward.claimed ? styles.rewardClaimed : reward.eligible ? styles.rewardEligible : styles.rewardLocked}>{reward.claimed ? `${reward.threshold.toLocaleString()}CF 景品付与済み` : reward.eligible ? `${reward.threshold.toLocaleString()}CF 到達` : `${reward.threshold.toLocaleString()}CF 未到達`}</span>{reward.eligible && !reward.claimed ? <button className={styles.rewardButton} type="button" onClick={() => void claimReward(account, reward)} disabled={claiming === key}>{claiming === key ? "処理中…" : "景品付与"}</button> : null}</div>; })}</div></div><div className={styles.accountBalance}><strong>{account.balance.toLocaleString()} CF</strong><span>現在の残高</span><small>最高 {account.peak_amount.toLocaleString()} CF</small></div></article>)}</div>}
        </section>
        <footer className={styles.footer}><Link href="/operator">運営トップへ戻る →</Link></footer>
      </main>
    </div>
  );
}
