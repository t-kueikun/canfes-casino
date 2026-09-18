"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./page.module.css";

type Code = { id: string; code: string; initial_amount: number; created_at: string; used_at: string | null; reusable?: boolean; qr_url?: string };
type IssuedCode = { code: string; initial_amount: number; qr_url: string; reused?: boolean };
type CodeFilter = "all" | "unused" | "used";
type Attendee = { id: string; display_name: string; active: boolean; balance: number; created_at: string; last_seen_at: string };

const amountPresets = [100, 300, 500, 1000];
const qrDisplayStorageKey = "canfes-qr-display-state";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function OperatorPage() {
  const router = useRouter();
  const [amount, setAmount] = useState(300);
  const [codes, setCodes] = useState<Code[]>([]);
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  const [filter, setFilter] = useState<CodeFilter>("all");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceNotice, setAttendanceNotice] = useState<string | null>(null);
  const [newArrivalIds, setNewArrivalIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const displayWindowRef = useRef<Window | null>(null);
  const displayChannelRef = useRef<BroadcastChannel | null>(null);
  const knownArrivalIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedAttendanceRef = useRef(false);
  const arrivalNoticeTimeoutRef = useRef<number | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  }, []);

  const loadCodes = async () => {
    setLoadingCodes(true);
    const headers = await authHeaders();
    const response = await fetch("/api/operator/codes", { cache: "no-store", headers });
    if (response.status === 401) { router.replace("/operator/login"); return; }
    const body = await response.json().catch(() => ({})) as { data?: Code[]; error?: string };
    const nextCodes = body.data ?? [];
    setCodes(nextCodes);
    const sharedCode = nextCodes.find((item) => item.reusable);
    if (sharedCode) {
      setIssued({
        code: sharedCode.code,
        initial_amount: sharedCode.initial_amount,
        qr_url: sharedCode.qr_url ?? `${window.location.origin}/guest?code=${encodeURIComponent(sharedCode.code)}`,
      });
    }
    if (!response.ok) setMessage({ type: "error", text: body.error ?? "発行履歴を読み込めませんでした" });
    setLoadingCodes(false);
  };

  const loadAttendance = useCallback(async () => {
    const response = await fetch("/api/operator/attendance", { cache: "no-store", headers: await authHeaders() });
    if (response.status === 401) { router.replace("/operator/login"); return; }
    const body = await response.json().catch(() => ({})) as { data?: Attendee[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? "来場受付を読み込めませんでした");

    const nextAttendees = body.data ?? [];
    const newArrivals = hasLoadedAttendanceRef.current
      ? nextAttendees.filter((attendee) => !knownArrivalIdsRef.current.has(attendee.id))
      : [];
    knownArrivalIdsRef.current = new Set(nextAttendees.map((attendee) => attendee.id));
    setAttendees(nextAttendees);
    setAttendanceLoading(false);

    if (newArrivals.length > 0) {
      setNewArrivalIds(new Set(newArrivals.map((attendee) => attendee.id)));
      setAttendanceNotice(newArrivals.length === 1
        ? `${newArrivals[0].display_name}さんが来場しました`
        : `${newArrivals.length}名の参加者が来場しました`);
      if (arrivalNoticeTimeoutRef.current) window.clearTimeout(arrivalNoticeTimeoutRef.current);
      arrivalNoticeTimeoutRef.current = window.setTimeout(() => {
        setAttendanceNotice(null);
        setNewArrivalIds(new Set());
      }, 15000);
    }
    hasLoadedAttendanceRef.current = true;
  }, [authHeaders, router]);

  const refreshAttendance = useCallback(async () => {
    try {
      await loadAttendance();
    } catch (attendanceError) {
      setAttendanceLoading(false);
      setMessage({ type: "error", text: attendanceError instanceof Error ? attendanceError.message : "来場受付を読み込めませんでした" });
    }
  }, [loadAttendance]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("canfes-qr-display");
    displayChannelRef.current = channel;
    return () => {
      channel.close();
      displayChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    getSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/operator/login");
      else { void loadCodes(); void refreshAttendance(); }
    });
  }, [refreshAttendance, router]);

  useEffect(() => {
    let interval: number | null = null;
    getSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      if (user) interval = window.setInterval(() => void refreshAttendance(), 5000);
    });
    return () => {
      if (interval) window.clearInterval(interval);
      if (arrivalNoticeTimeoutRef.current) window.clearTimeout(arrivalNoticeTimeoutRef.current);
    };
  }, [refreshAttendance]);

  const issueCode = async () => {
    if (amount < 0 || amount > 100000) {
      setMessage({ type: "error", text: "初期CFは0〜100,000の範囲で入力してください" });
      return;
    }
    const displayWindow = openDisplayWindow();
    clearDisplay();
    setLoading(true);
    setMessage(null);
    setCopied(false);
    const response = await fetch("/api/operator/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ initialAmount: amount }),
    });
    const body = await response.json().catch(() => ({})) as IssuedCode & { error?: string };
    if (!response.ok) setMessage({ type: "error", text: body.error ?? "QRコードの発行に失敗しました" });
    else {
      setIssued(body);
      const displayOpened = publishDisplay(body, displayWindow);
      setMessage({ type: displayOpened ? "success" : "error", text: displayOpened ? (body.reused ? "共通受付QRを再表示しました" : "共通受付QRを発行しました。表示画面も更新しました") : "QR表示画面を開けませんでした。ブラウザのポップアップを許可してください" });
      await loadCodes();
    }
    setLoading(false);
  };

  const copyLink = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.qr_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setMessage({ type: "error", text: "リンクをコピーできませんでした。QRコードを直接お使いください" });
    }
  };

  const openDisplayWindow = () => {
    if (displayWindowRef.current && !displayWindowRef.current.closed) {
      displayWindowRef.current.focus();
      return displayWindowRef.current;
    }
    const displayWindow = window.open("/operator/qr", "canfes-qr-display", "popup=yes,width=900,height=900");
    if (displayWindow) {
      displayWindowRef.current = displayWindow;
      displayWindow.focus();
    }
    return displayWindow;
  };

  const clearDisplay = () => {
    displayChannelRef.current?.postMessage({ type: "clear" });
    try { localStorage.removeItem(qrDisplayStorageKey); } catch { /* storage is optional */ }
  };

  const publishDisplay = (value: IssuedCode, displayWindow?: Window | null) => {
    const payload = { type: "data", data: { code: value.code, amount: value.initial_amount, url: value.qr_url }, updatedAt: Date.now() };
    displayChannelRef.current?.postMessage(payload);
    try { localStorage.setItem(qrDisplayStorageKey, JSON.stringify(payload)); } catch { /* storage is optional */ }
    const targetWindow = displayWindow ?? displayWindowRef.current;
    if (targetWindow && !targetWindow.closed) {
      targetWindow.focus();
      return true;
    }
    return false;
  };

  const openDisplay = () => {
    const displayWindow = openDisplayWindow();
    if (!issued) return;
    const displayOpened = publishDisplay(issued, displayWindow);
    if (!displayOpened) setMessage({ type: "error", text: "表示画面を開けませんでした。ブラウザのポップアップを許可してください" });
  };

  const showHistoryQr = (item: Code) => {
    const value: IssuedCode = {
      code: item.code,
      initial_amount: item.initial_amount,
      qr_url: item.qr_url ?? `${window.location.origin}/guest?code=${encodeURIComponent(item.code)}`,
    };
    setIssued(value);
    clearDisplay();
    const displayWindow = openDisplayWindow();
    const displayOpened = publishDisplay(value, displayWindow);
    setMessage({ type: displayOpened ? "success" : "error", text: displayOpened ? "未使用のQRを表示しました" : "QR表示画面を開けませんでした。ポップアップを許可してください" });
  };

  const logout = async () => {
    await getSupabaseClient().auth.signOut();
    router.replace("/operator/login");
  };

  const filteredCodes = codes.filter((item) => {
    if (filter === "unused") return !item.used_at;
    if (filter === "used") return Boolean(item.used_at);
    return true;
  });
  const unusedCount = codes.filter((item) => !item.used_at).length;
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.topbar}>
          <Link className={styles.brand} href="/operator">
            <span className={styles.brandMark}>爆</span>
            <span><strong>爆裂カジノ</strong><small>OPERATOR</small></span>
          </Link>
          <div className={styles.topbarActions}>
            <span className={styles.liveBadge}><span />運営モード</span>
            <button className={styles.logoutButton} onClick={() => void logout()}>ログアウト</button>
          </div>
        </header>

        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>キャンパスフェスティバル横浜キャンパス</p>
            <h1>運営</h1>
            <p className={styles.heroCopy}>参加者全員で使える共通受付QRを表示できます。</p>
          </div>
          <div className={styles.heroLinks}>
            <Link href="/operator/scan">QRを読み取る</Link>
            <Link href="/operator/payments">チップ購入QRを表示</Link>
            <Link href="/operator/payments/refund">チップ払い戻しQRを発行</Link>
          </div>
        </section>

        <details className={styles.detailsCard}>
          <summary><strong>来場状況</strong><span>{attendanceLoading ? "確認中…" : `${attendees.length}人`}</span></summary>
          <section className={`${styles.card} ${styles.attendanceCard}`} aria-labelledby="attendance-title">
          <div className={styles.attendanceHeader}>
            <div><h2 id="attendance-title">来場受付</h2><p>QRから参加登録した人を確認できます。</p></div>
            <span className={styles.attendanceStatus}><span />5秒ごとに更新</span>
          </div>
          {attendanceNotice ? <div className={styles.arrivalNotice} role="status"><span>✓</span><strong>{attendanceNotice}</strong></div> : null}
          {attendanceLoading ? <p className={styles.emptyState}>来場受付を読み込んでいます…</p> : attendees.length === 0 ? <p className={styles.emptyState}>まだ来場受付はありません。</p> : <div className={styles.attendanceList}>{attendees.slice(0, 8).map((attendee) => <div key={attendee.id} className={`${styles.attendanceItem} ${newArrivalIds.has(attendee.id) ? styles.attendanceItemNew : ""}`}><div><strong>{attendee.display_name}</strong><span>{formatDate(attendee.created_at)} に受付</span></div><div className={styles.attendanceDetails}><strong>{attendee.balance.toLocaleString()} CF</strong>{newArrivalIds.has(attendee.id) ? <span className={styles.newArrivalBadge}>新着</span> : null}</div></div>)}</div>}
          <Link className={styles.attendanceLink} href="/operator/accounts">全参加者の残高・景品状況を見る →</Link>
          </section>
        </details>

        {message ? <div className={`${styles.notice} ${message.type === "error" ? styles.noticeError : styles.noticeSuccess}`} role="status">{message.type === "error" ? "!" : "✓"}<span>{message.text}</span></div> : null}

        <div className={styles.contentGrid}>
          <section className={`${styles.card} ${styles.issueCard}`}>
            <div className={styles.cardHeader}>
              <div><h2>共通受付QRを発行</h2><p>同じQRを何度でも使って、参加者ごとにアカウントを作成できます。</p></div>
            </div>
            <div className={styles.formField}>
              <label htmlFor="initial-amount">初期CF</label>
              <div className={styles.amountInput}><input id="initial-amount" type="number" min={0} max={100000} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><span>CF</span></div>
              <div className={styles.presetRow} aria-label="初期CFのプリセット">
                {amountPresets.map((preset) => <button key={preset} className={amount === preset ? styles.presetActive : styles.presetButton} type="button" onClick={() => setAmount(preset)}>{preset.toLocaleString()}</button>)}
              </div>
            </div>
            <button className={styles.primaryButton} onClick={() => void issueCode()} disabled={loading}>{loading ? <><span className={styles.spinner} />発行しています…</> : <>QRコードを発行する <span>→</span></>}</button>
            <p className={styles.helper}>一度発行したQRは、次回以降も同じものを表示して使えます。</p>
          </section>

        </div>

        {issued ? <section className={`${styles.card} ${styles.issuedCard}`}>
          <div className={styles.issuedHeader}><div><span className={styles.cardKicker}>LATEST ISSUE</span><h2>QRを配布できます</h2><p>このQRを参加者に見せるか、リンクを共有してください。</p></div><span className={styles.successMark}>✓</span></div>
          <div className={styles.issuedBody}>
            <div className={styles.qrFrame}><QRCodeCanvas value={issued.qr_url} size={210} includeMargin /></div>
            <div className={styles.issuedDetails}>
              <div className={styles.detailItem}><span>初期残高</span><strong>{issued.initial_amount.toLocaleString()} CF</strong></div>
              <div className={styles.detailItem}><span>受付コード</span><code>{issued.code}</code></div>
              <div className={styles.resultActions}><button className={styles.displayButton} type="button" onClick={openDisplay}>別モニターで表示 ↗</button><button className={styles.secondaryButton} type="button" onClick={() => void copyLink()}>{copied ? "コピーしました ✓" : "リンクをコピー"}</button><a className={styles.primaryLink} href={issued.qr_url} target="_blank" rel="noreferrer">参加者画面を開く ↗</a></div>
            </div>
          </div>
        </section> : null}

        <details className={styles.detailsCard}>
          <summary><strong>発行したQRの履歴</strong><span>{loadingCodes ? "確認中…" : `${unusedCount}件が未使用`}</span></summary>
          <section className={`${styles.card} ${styles.historyCard}`}>
          <div className={styles.historyHeader}>
            <div><h2>発行履歴</h2></div>
            <button className={styles.refreshButton} type="button" onClick={() => void loadCodes()} disabled={loadingCodes}>{loadingCodes ? "読み込み中…" : "更新 ↻"}</button>
          </div>
          <div className={styles.filterRow} role="tablist" aria-label="発行履歴の絞り込み">
            {([ ["all", "すべて"], ["unused", "未使用"], ["used", "使用済み"] ] as [CodeFilter, string][]).map(([value, label]) => <button key={value} className={filter === value ? styles.filterActive : styles.filterButton} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
          <div className={styles.historyList}>
            {loadingCodes ? <p className={styles.emptyState}>履歴を読み込んでいます…</p> : filteredCodes.length === 0 ? <p className={styles.emptyState}>{filter === "all" ? "まだQRを発行していません。" : "該当する履歴はありません。"}</p> : filteredCodes.map((item) => <div key={item.id} className={styles.historyItem}><div><strong>{item.code}</strong><span>{formatDate(item.created_at)} ・ {item.initial_amount.toLocaleString()} CF</span></div><div className={styles.historyItemActions}><span className={item.used_at ? styles.statusUsed : styles.statusUnused}>{item.used_at ? "使用済み" : "未使用"}</span>{!item.used_at ? <button className={styles.historyQrButton} type="button" onClick={() => showHistoryQr(item)}>QR表示 ↗</button> : null}</div></div>)}
          </div>
          </section>
        </details>

        <footer className={styles.footerLinks}><Link href="/operator/accounts">参加者・景品管理</Link></footer>
      </main>
    </div>
  );
}
