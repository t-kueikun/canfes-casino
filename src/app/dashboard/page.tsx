"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import BottomNavigationBar from "../components/BottomNavigationBar";
import styles from "./page.module.css";

type Account = { id: string; display_name: string };
type HistoryRow = { id: string; name: string | null; amount: number | null; type: string | null; timestamp: string | null };
type RevivalRequest = { id: string; requested_at: string; eligible_at: string; status: "pending" | "approved" | "rejected" };
type RevivalStatus = { balance: number; request: RevivalRequest | null };

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [revival, setRevival] = useState<RevivalStatus | null>(null);
  const [revivalSubmitting, setRevivalSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const accountResponse = await fetch("/api/guest/account", { cache: "no-store" });
    if (accountResponse.status === 401) { router.replace("/guest"); return; }
    if (!accountResponse.ok) { setError("アカウント情報を読み込めませんでした。"); setLoading(false); return; }
    const accountBody = await accountResponse.json() as { account: Account; balance: number };
    setAccount(accountBody.account);
    setBalance(accountBody.balance);

    const [historyResponse, revivalResponse] = await Promise.all([
      fetch("/api/payment/history", { cache: "no-store" }),
      fetch("/api/guest/revival", { cache: "no-store" }),
    ]);
    if (historyResponse.ok) {
      const body = await historyResponse.json() as { data?: HistoryRow[] };
      setHistory(body.data ?? []);
    }
    if (revivalResponse.ok) setRevival(await revivalResponse.json() as RevivalStatus);
    setLoading(false);
  }, [router]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const requestRevival = async () => {
    setRevivalSubmitting(true);
    setError(null);
    const response = await fetch("/api/guest/revival", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) setError(body.error ?? "復活申請を送信できませんでした。");
    else await loadDashboard();
    setRevivalSubmitting(false);
  };

  const revivalRequest = revival?.request;
  const revivalMinutes = revivalRequest ? Math.max(0, Math.ceil((new Date(revivalRequest.eligible_at).getTime() - Date.now()) / 60000)) : 0;

  return (
    <div className={styles.pageContainer}>
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>爆裂カジノ / PARTICIPANT</p><h1>{account?.display_name ?? "参加者"}さん</h1></div>
        </header>
        {error ? <div className={styles.historyState} style={{ color: "#ef4444" }}>{error}</div> : null}
        <section className={styles.balanceContainer} aria-label="チップ残高">
          <div className={styles.balanceActions}>
            <button className={styles.actionButton} onClick={() => router.push("/dashboard/rewards")}><Image src="/icons/Request Icon.svg" alt="景品" width={32} height={32} className={styles.actionIcon} /><span>景品</span></button>
            <button className={styles.actionButton} onClick={() => router.push("/dashboard/history")}><Image src="/icons/History Icon.svg" alt="履歴" width={32} height={32} className={styles.actionIcon} /><span>履歴</span></button>
          </div>
          <div className={styles.balanceDisplayCard}>
            <div className={styles.balanceTitle}>爆裂カジノチップ</div>
            <div className={styles.balanceAmount}>{loading ? "..." : `${(balance ?? 0).toLocaleString()} CF`}</div>
            <div className={styles.logoWrapper}><Image src="/festa-casino.svg" alt="爆裂カジノ" width={30} height={30} /></div>
          </div>
        </section>
        {!loading && (balance ?? 0) === 0 ? <section className={styles.revivalCard} aria-labelledby="revival-title">
          <span className={styles.revivalKicker}>CHIP REVIVAL</span>
          <h2 id="revival-title">チップ復活申請</h2>
          {revivalRequest?.status === "pending" ? <>
            <p className={styles.revivalCopy}>申請を受け付けました。スタッフが20分経過後に承認すると、300 CFが戻ります。</p>
            <div className={styles.revivalStatus}>{revivalMinutes > 0 ? `承認まであと約${revivalMinutes}分` : "スタッフの承認待ちです"}</div>
            <button type="button" className={styles.historyActionButton} onClick={() => void loadDashboard()} disabled={loading}>状態を更新</button>
          </> : <>
            <p className={styles.revivalCopy}>{revivalRequest?.status === "rejected" ? "前回の申請は却下されました。残高が0の場合はもう一度申請できます。" : "残高が0になったとき、スタッフに復活を申請できます。スタッフが20分経過後に承認すると300 CFが戻ります。"}</p>
            <button type="button" className={styles.revivalButton} onClick={() => void requestRevival()} disabled={revivalSubmitting}>{revivalSubmitting ? "申請中…" : "復活を申請する"}</button>
          </>}
        </section> : null}
        <section className={styles.requestsCard}>
          <div className={styles.historyHeader}><h2 className={styles.requestsTitle}>最近の利用履歴</h2><button type="button" className={styles.historyActionButton} onClick={() => void loadDashboard()} disabled={loading}>更新</button></div>
          {history.length === 0 ? <div className={styles.historyState}>まだ履歴がありません。</div> : history.slice(0, 5).map((entry) => <div key={entry.id} className={styles.historyRow}><span>{entry.name || "チップ取引"}</span><strong className={entry.amount && entry.amount < 0 ? styles.amountNegative : styles.amountPositive}>{entry.amount && entry.amount > 0 ? "+" : ""}{entry.amount ?? 0} CF</strong></div>)}
        </section>
      </main>
      <div className={styles.footerContainer}><BottomNavigationBar /></div>
    </div>
  );
}
