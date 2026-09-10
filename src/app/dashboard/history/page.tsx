"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNavigationBar from '../../components/BottomNavigationBar';
import styles from '../page.module.css';

type TransactionRow = {
  id: string;
  name: string | null;
  amount: number | null;
  type: string | null;
  timestamp: string | null;
};

type GroupedHistory = {
  label: string;
  items: TransactionRow[];
};

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const router = useRouter();

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/payment/history', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.status === 401) {
        router.replace('/guest');
        setTransactions([]);
        setLoading(false);
        return;
      }
      if (!response.ok) {
        console.error('[history] history api failed', response.status);
        setError('履歴の取得に失敗しました。時間をおいて再度お試しください。');
        setTransactions([]);
        setLoading(false);
        return;
      }
      const body = (await response.json().catch(() => null)) as { data?: unknown } | null;
      const rows = Array.isArray(body?.data) ? (body?.data as TransactionRow[]) : [];
      setTransactions(rows);
    } catch (error) {
      console.error('[history] history api error', error);
      setError('履歴の取得に失敗しました。ネットワーク環境をご確認ください。');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const groupedHistory = useMemo<GroupedHistory[]>(() => {
    const groups = new Map<string, TransactionRow[]>();
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    const resolveKey = (timestamp: string | null) => {
      if (!timestamp) return 'その他';
      const date = new Date(timestamp);
      if (!Number.isFinite(date.getTime())) return 'その他';
      return date.toISOString().slice(0, 10);
    };

    const resolveLabel = (key: string) => {
      if (key === todayKey) return '今日';
      if (key === yesterdayKey) return '昨日';
      const date = new Date(key);
      if (!Number.isFinite(date.getTime())) return 'その他';
      const formatter = new Intl.DateTimeFormat('ja-JP', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      });
      return formatter.format(date);
    };

    transactions.forEach((tx) => {
      const key = resolveKey(tx.timestamp);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(tx);
    });

    const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
      const dateA = new Date(a).getTime();
      const dateB = new Date(b).getTime();
      return dateB - dateA;
    });

    return sortedKeys.map((key) => ({
      label: resolveLabel(key),
      items: groups.get(key) ?? [],
    }));
  }, [transactions]);

  const formatAmount = (tx: TransactionRow) => {
    if (typeof tx.amount !== 'number' || !Number.isFinite(tx.amount)) return '—';
    const abs = tx.amount.toLocaleString();
    if (tx.type === 'charge') return `+${abs} CF`;
    if (tx.type === 'spend') return `-${abs} CF`;
    return `${tx.amount >= 0 ? '+' : ''}${tx.amount.toLocaleString()} CF`;
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '--:--';
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return '--:--';
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const splitTitle = (name: string | null) => {
    if (!name) return { primary: '取引', secondary: null };
    const match = name.match(/^(.+?)\s*\((.+)\)$/);
    if (match) {
      return { primary: match[1], secondary: match[2] };
    }
    return { primary: name, secondary: null };
  };

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className={styles.historyState}>読み込み中です...</div>
      );
    }

    if (error) {
      return (
        <div className={styles.historyState} style={{ color: '#ef4444' }}>
          {error}
        </div>
      );
    }

    if (transactions.length === 0) {
      return (
        <div className={styles.historyState}>まだ履歴がありません。</div>
      );
    }

    return (
      <div className={styles.historySections}>
        {groupedHistory.map((group) => (
          <section key={group.label} className={styles.historySection}>
            <h3 className={styles.historySectionTitle}>{group.label}</h3>
            <ul className={styles.historyList}>
              {group.items.map((tx) => (
                <li key={tx.id} className={styles.historyCardRow}>
                  <div className={styles.historyCardLeft}>
                    <div className={styles.historyAvatar}>
                      {tx.type === 'charge' ? '💰' : tx.type === 'spend' ? '💸' : '📄'}
                    </div>
                    <div className={styles.historyCardInfo}>
                      {(() => {
                        const { primary, secondary } = splitTitle(tx.name ?? null);
                        return (
                          <>
                            <div className={styles.historyCardTitle}>{primary}</div>
                            {secondary ? (
                              <div className={styles.historyCardSubtitle}>{secondary}</div>
                            ) : null}
                          </>
                        );
                      })()}
                      <div className={styles.historyCardMeta}>{formatTime(tx.timestamp)}</div>
                    </div>
                  </div>
                  <div className={styles.historyCardRight}>
                    <div className={styles.historyCardAmountWrapper}>
                      <div className={styles.historyCardAmount}>{formatAmount(tx)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }, [error, groupedHistory, loading]);

  return (
    <div className={styles.pageContainer}>
      <main className={styles.mainContent}>
        <div className={styles.historyContainer}>
          <header className={styles.historyHeaderBar}>
            <div className={styles.historyHeaderLeft}>
              <button
                type="button"
                className={styles.historyBackButton}
                onClick={() => router.back()}
              >
                ←
              </button>
              <div>
                <h1 className={styles.historyTitle}>取引履歴</h1>
                <p className={styles.historySubtitle}>最近の支払いとチャージを確認できます</p>
              </div>
            </div>
            <button
              type="button"
              className={styles.historyRefreshButton}
              onClick={() => void fetchHistory()}
            >
              {loading ? '更新中…' : '更新'}
            </button>
          </header>
          {content}
        </div>
      </main>
      <div className={styles.footerContainer}>
        <BottomNavigationBar />
      </div>
    </div>
  );
}
