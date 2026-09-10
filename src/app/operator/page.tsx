"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

type Code = { id: string; code: string; initial_amount: number; created_at: string; used_at: string | null; qr_url?: string };
type IssuedCode = { code: string; initial_amount: number; qr_url: string };
type DrawState = { drawn_numbers: number[]; current_number: number | null; active: boolean };
type CodeFilter = "all" | "unused" | "used";

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
  const [drawState, setDrawState] = useState<DrawState>({ drawn_numbers: [], current_number: null, active: false });
  const [filter, setFilter] = useState<CodeFilter>("all");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [loadingBingo, setLoadingBingo] = useState(false);
  const [copied, setCopied] = useState(false);
  const displayWindowRef = useRef<Window | null>(null);
  const displayChannelRef = useRef<BroadcastChannel | null>(null);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  };

  const loadCodes = async () => {
    setLoadingCodes(true);
    const headers = await authHeaders();
    const response = await fetch("/api/operator/codes", { cache: "no-store", headers });
    if (response.status === 401) { router.replace("/operator/login"); return; }
    const body = await response.json().catch(() => ({})) as { data?: Code[]; error?: string };
    setCodes(body.data ?? []);
    if (!response.ok) setMessage({ type: "error", text: body.error ?? "発行履歴を読み込めませんでした" });
    setLoadingCodes(false);
  };

  const loadBingo = async () => {
    const response = await fetch("/api/bingo/draw", { cache: "no-store" });
    if (response.ok) setDrawState(await response.json() as DrawState);
  };

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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/operator/login");
      else { void loadCodes(); void loadBingo(); }
    });
  }, [router]);

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
      setMessage({ type: displayOpened ? "success" : "error", text: displayOpened ? "QRコードを発行しました。表示画面も更新しました" : "QRコードは発行しましたが、表示画面を開けませんでした。ポップアップを許可してください" });
      await loadCodes();
    }
    setLoading(false);
  };

  const draw = async () => {
    setLoadingBingo(true);
    setMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch("/api/bingo/draw", {
      method: "POST",
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    const body = await response.json().catch(() => ({})) as DrawState & { error?: string };
    if (!response.ok) setMessage({ type: "error", text: body.error ?? "抽選に失敗しました" });
    else { setDrawState(body); setMessage({ type: "success", text: `${body.current_number} を発表しました` }); }
    setLoadingBingo(false);
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
    await supabase.auth.signOut();
    router.replace("/operator/login");
  };

  const filteredCodes = codes.filter((item) => {
    if (filter === "unused") return !item.used_at;
    if (filter === "used") return Boolean(item.used_at);
    return true;
  });
  const unusedCount = codes.filter((item) => !item.used_at).length;
  const usedCount = codes.filter((item) => Boolean(item.used_at)).length;

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
            <p className={styles.eyebrow}>キャンパスフェスティバル横浜キャンパス / EVENT CONTROL</p>
            <h1>運営ダッシュボード</h1>
            <p className={styles.heroCopy}>参加者の受付とゲーム進行を、ここからまとめて管理できます。</p>
          </div>
          <div className={styles.heroLinks}>
            <Link href="/guest" target="_blank">参加者入口 ↗</Link>
            <Link href="/dashboard/bingo/control">ビンゴ進行 →</Link>
          </div>
        </section>

        <section className={styles.statsGrid} aria-label="運営状況">
          <div className={styles.statCard}><span>発行済みQR</span><strong>{codes.length}</strong><small>累計</small></div>
          <div className={styles.statCard}><span>未使用</span><strong>{unusedCount}</strong><small>受付待ち</small></div>
          <div className={styles.statCard}><span>使用済み</span><strong>{usedCount}</strong><small>参加登録済み</small></div>
        </section>

        {message ? <div className={`${styles.notice} ${message.type === "error" ? styles.noticeError : styles.noticeSuccess}`} role="status">{message.type === "error" ? "!" : "✓"}<span>{message.text}</span></div> : null}

        <div className={styles.contentGrid}>
          <section className={`${styles.card} ${styles.issueCard}`}>
            <div className={styles.cardHeader}>
              <div><span className={styles.cardKicker}>STEP 01</span><h2>参加者QRを発行</h2><p>参加者のスマートフォンで読み取るQRを作成します。</p></div>
              <span className={styles.stepNumber}>01</span>
            </div>
            <div className={styles.formField}>
              <label htmlFor="initial-amount">初期CF</label>
              <div className={styles.amountInput}><input id="initial-amount" type="number" min={0} max={100000} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><span>CF</span></div>
              <div className={styles.presetRow} aria-label="初期CFのプリセット">
                {amountPresets.map((preset) => <button key={preset} className={amount === preset ? styles.presetActive : styles.presetButton} type="button" onClick={() => setAmount(preset)}>{preset.toLocaleString()}</button>)}
              </div>
            </div>
            <button className={styles.primaryButton} onClick={() => void issueCode()} disabled={loading}>{loading ? <><span className={styles.spinner} />発行しています…</> : <>QRコードを発行する <span>→</span></>}</button>
            <p className={styles.helper}>最初の発行時に別モニターの表示画面を自動で開きます。以後は発行するたびに同じ画面のQRが自動更新されます。</p>
          </section>

          <section className={`${styles.card} ${styles.bingoCard}`}>
            <div className={styles.cardHeader}>
              <div><span className={styles.cardKicker}>STEP 02</span><h2>ビンゴ進行</h2><p>会場スクリーンに出す番号を抽選します。</p></div>
              <span className={styles.bingoIcon}>B</span>
            </div>
            <div className={styles.currentNumber} aria-label="現在のビンゴ番号"><small>現在の番号</small><strong>{drawState.current_number ?? "—"}</strong></div>
            <button className={styles.secondaryButton} onClick={() => void draw()} disabled={loadingBingo}>{loadingBingo ? "抽選中…" : "次の番号を抽選"}<span>↗</span></button>
            <Link className={styles.textLink} href="/dashboard/bingo/control">詳細な進行画面を開く →</Link>
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

        <section className={`${styles.card} ${styles.historyCard}`}>
          <div className={styles.historyHeader}>
            <div><span className={styles.cardKicker}>ACTIVITY</span><h2>発行履歴</h2></div>
            <button className={styles.refreshButton} type="button" onClick={() => void loadCodes()} disabled={loadingCodes}>{loadingCodes ? "読み込み中…" : "更新 ↻"}</button>
          </div>
          <div className={styles.filterRow} role="tablist" aria-label="発行履歴の絞り込み">
            {([ ["all", "すべて"], ["unused", "未使用"], ["used", "使用済み"] ] as [CodeFilter, string][]).map(([value, label]) => <button key={value} className={filter === value ? styles.filterActive : styles.filterButton} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
          <div className={styles.historyList}>
            {loadingCodes ? <p className={styles.emptyState}>履歴を読み込んでいます…</p> : filteredCodes.length === 0 ? <p className={styles.emptyState}>{filter === "all" ? "まだQRを発行していません。" : "該当する履歴はありません。"}</p> : filteredCodes.map((item) => <div key={item.id} className={styles.historyItem}><div><strong>{item.code}</strong><span>{formatDate(item.created_at)} ・ {item.initial_amount.toLocaleString()} CF</span></div><div className={styles.historyItemActions}><span className={item.used_at ? styles.statusUsed : styles.statusUnused}>{item.used_at ? "使用済み" : "未使用"}</span>{!item.used_at ? <button className={styles.historyQrButton} type="button" onClick={() => showHistoryQr(item)}>QR表示 ↗</button> : null}</div></div>)}
          </div>
        </section>

        <footer className={styles.footerLinks}><Link href="/dashboard/bingo/control">ビンゴ進行</Link><span>•</span><Link href="/guest">参加者入口</Link></footer>
      </main>
    </div>
  );
}
