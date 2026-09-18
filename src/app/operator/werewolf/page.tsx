"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./page.module.css";

type Phase = "night" | "day";
type Player = { id: string; display_name: string; votes: number };
type ControlResponse = { state: { phase: Phase; round: number; updated_at: string }; players: Player[]; totalVotes: number };

export const dynamic = "force-dynamic";

export default function OperatorWerewolfPage() {
  const router = useRouter();
  const [data, setData] = useState<ControlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);
  const [audienceUrl, setAudienceUrl] = useState("");
  const [copiedAudienceUrl, setCopiedAudienceUrl] = useState(false);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/operator/werewolf", { cache: "no-store", headers: await authHeaders() });
      if (response.status === 401) { router.replace(`/operator/login?next=${encodeURIComponent("/operator/werewolf")}`); return; }
      const body = await response.json().catch(() => ({})) as ControlResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "人狼の進行情報を読み込めませんでした");
      setData(body);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "人狼の進行情報を読み込めませんでした");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    getSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace(`/operator/login?next=${encodeURIComponent("/operator/werewolf")}`); else void load(true);
    });
  }, [load, router]);

  useEffect(() => { setAudienceUrl(`${window.location.origin}/werewolf`); }, []);

  useEffect(() => {
    if (!data) return;
    const timer = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(timer);
  }, [data, load]);

  const changePhase = async (phase: Phase) => {
    setChanging(true);
    setMessage(null);
    try {
      const response = await fetch("/api/operator/werewolf", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ phase }) });
      if (response.status === 401) { router.replace(`/operator/login?next=${encodeURIComponent("/operator/werewolf")}`); return; }
      const body = await response.json().catch(() => ({})) as { state?: ControlResponse["state"]; error?: string };
      if (!response.ok || !body.state) throw new Error(body.error ?? "進行を変更できませんでした");
      setData((current) => current ? { ...current, state: body.state! } : current);
      setMessage(phase === "day" ? "昼に切り替えました。観客が投票できます" : "夜に切り替えました。投票を停止しました");
    } catch (phaseError) {
      setError(phaseError instanceof Error ? phaseError.message : "進行を変更できませんでした");
    } finally {
      setChanging(false);
    }
  };

  const addPlayer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const displayName = playerName.trim();
    if (!displayName || addingPlayer) return;
    setAddingPlayer(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/operator/werewolf/players", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ display_name: displayName }),
      });
      if (response.status === 401) { router.replace(`/operator/login?next=${encodeURIComponent("/operator/werewolf")}`); return; }
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "プレイヤーを追加できませんでした");
      setPlayerName("");
      setMessage(`${displayName}さんを人狼プレイヤーに追加しました`);
      await load();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "プレイヤーを追加できませんでした");
    } finally {
      setAddingPlayer(false);
    }
  };

  const copyAudienceUrl = async () => {
    try {
      await navigator.clipboard.writeText(audienceUrl);
      setCopiedAudienceUrl(true);
      window.setTimeout(() => setCopiedAudienceUrl(false), 2000);
    } catch {
      setError("観客ページのURLをコピーできませんでした");
    }
  };

  const deletePlayer = async (player: Player) => {
    if (deletingPlayerId || !window.confirm(`${player.display_name}さんを人狼プレイヤーから削除しますか？`)) return;
    setDeletingPlayerId(player.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/operator/werewolf/players", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ id: player.id }),
      });
      if (response.status === 401) { router.replace(`/operator/login?next=${encodeURIComponent("/operator/werewolf")}`); return; }
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "プレイヤーを削除できませんでした");
      setMessage(`${player.display_name}さんを削除しました`);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "プレイヤーを削除できませんでした");
    } finally {
      setDeletingPlayerId(null);
    }
  };

  const sortedPlayers = [...(data?.players ?? [])].sort((a, b) => b.votes - a.votes || a.display_name.localeCompare(b.display_name, "ja"));
  const isDay = data?.state.phase === "day";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.topbar}><Link className={styles.brand} href="/operator"><span className={styles.brandMark}>爆</span><span><strong>爆裂カジノ</strong><small>OPERATOR</small></span></Link><div className={styles.topbarActions}><Link className={styles.backLink} href="/operator">運営トップ</Link><Link className={styles.audienceLink} href="/werewolf" target="_blank">観客画面 ↗</Link></div></header>
        <header className={styles.hero}><div><p className={styles.eyebrow}>WEREWOLF / EVENT CONTROL</p><h1>人狼進行</h1><p>昼・夜を切り替えて、観客投票をコントロールします。</p></div><span className={`${styles.phaseBadge} ${isDay ? styles.phaseDay : styles.phaseNight}`}><span />現在：{isDay ? "昼" : "夜"}</span></header>

        {error ? <div className={styles.error} role="alert">{error}<button type="button" onClick={() => void load(true)}>再読み込み</button></div> : null}
        {message ? <div className={styles.message} role="status">✓ <span>{message}</span></div> : null}

        <section className={styles.controlCard} aria-labelledby="phase-title">
          <div className={styles.cardHeader}><div><span className={styles.cardKicker}>ROUND {data?.state.round ?? "—"}</span><h2 id="phase-title">進行フェーズ</h2><p>{isDay ? "観客投票を受け付けています。" : "投票は停止中です。"}</p></div><span className={styles.cardIcon}>{isDay ? "☀" : "☾"}</span></div>
          <div className={styles.phaseButtons}><button type="button" className={isDay ? styles.dayButtonActive : styles.dayButton} onClick={() => void changePhase("day")} disabled={changing || isDay}><strong>昼</strong><span>投票を受け付ける</span></button><button type="button" className={!isDay ? styles.nightButtonActive : styles.nightButton} onClick={() => void changePhase("night")} disabled={changing || !isDay}><strong>夜</strong><span>投票を停止する</span></button></div>
          <p className={styles.helper}>「夜 → 昼」に切り替えるたびにラウンドが進み、投票が新しく集計されます。</p>
        </section>

        <section className={styles.playersCard} aria-labelledby="players-title">
          <div className={styles.playersHeader}><div><span className={styles.cardKicker}>PLAYER ROSTER</span><h2 id="players-title">人狼プレイヤーを追加</h2><p>観客投票に表示するゲーム参加者を登録します。通常の参加者アカウントとは別管理です。</p></div><strong>{data?.players.length ?? 0}<small>人</small></strong></div>
          <form className={styles.addPlayerForm} onSubmit={(event) => void addPlayer(event)}>
            <label htmlFor="werewolf-player-name">プレイヤー名</label>
            <div className={styles.addPlayerRow}><input id="werewolf-player-name" value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={40} placeholder="例：プレイヤーA" autoComplete="off" required /><button type="submit" disabled={addingPlayer || !playerName.trim()}>{addingPlayer ? "追加中…" : "プレイヤーを追加"}</button></div>
          </form>
          {data?.players.length ? <div className={styles.playerRoster} aria-label="登録済みプレイヤー">{data.players.map((player) => <span className={styles.playerChip} key={player.id}><strong>{player.display_name}</strong><button type="button" onClick={() => void deletePlayer(player)} disabled={deletingPlayerId !== null} aria-label={`${player.display_name}さんを削除`}>×</button></span>)}</div> : <p className={styles.stateText}>まだプレイヤーがいません。名前を入力して追加してください。</p>}
        </section>

        <section className={styles.resultsCard} aria-labelledby="results-title"><div className={styles.resultsHeader}><div><span className={styles.cardKicker}>LIVE RESULTS</span><h2 id="results-title">観客投票</h2></div><strong className={styles.totalVotes}>{data?.totalVotes ?? 0}<small>票</small></strong></div>{loading ? <p className={styles.stateText}>集計を読み込んでいます…</p> : sortedPlayers.length === 0 ? <p className={styles.stateText}>人狼プレイヤーがまだ登録されていません。</p> : <div className={styles.resultList}>{sortedPlayers.map((player) => <div className={styles.resultRow} key={player.id}><div className={styles.resultIdentity}><span className={styles.rank}>{player.votes > 0 ? sortedPlayers.findIndex((item) => item.votes === player.votes) + 1 : "—"}</span><strong>{player.display_name}</strong></div><div className={styles.barArea}><span className={styles.bar}><i style={{ width: `${data && data.totalVotes > 0 ? Math.round((player.votes / data.totalVotes) * 100) : 0}%` }} /></span><b>{player.votes}</b></div></div>)}</div>}</section>

        <section className={styles.audienceCard} aria-labelledby="audience-qr-title">
          <div><span className={styles.cardKicker}>AUDIENCE QR</span><h2 id="audience-qr-title">観客向け投票QR</h2><p>このQRを会場に掲示してください。一般観客は読み取ると投票ページを開けます。</p></div>
          <div className={styles.audienceQrFrame}>{audienceUrl ? <QRCodeCanvas value={audienceUrl} size={210} includeMargin level="M" /> : null}</div>
          <code className={styles.audienceUrl}>{audienceUrl}</code>
          <div className={styles.audienceActions}><button type="button" onClick={() => void copyAudienceUrl()}>{copiedAudienceUrl ? "コピーしました ✓" : "URLをコピー"}</button><Link href="/werewolf" target="_blank">観客ページを開く ↗</Link></div>
        </section>
        <p className={styles.note}>投票の更新は約2秒ごとに反映されます。人狼の正解はこの画面では判定しません。</p>
        <footer className={styles.footer}><Link href="/operator">運営トップへ戻る →</Link></footer>
      </main>
    </div>
  );
}
