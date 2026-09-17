"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./page.module.css";

export default function OperatorLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const getNextPath = () => {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") && !next.startsWith("//") && (next.startsWith("/operator/") || next.startsWith("/rewards/redeem")) ? next : "/operator";
  };

  useEffect(() => {
    getSupabaseClient().auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(getNextPath());
    });
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const client = getSupabaseClient();
    const result = mode === "login"
      ? await client.auth.signInWithPassword({ email, password })
      : await fetch("/api/operator/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, invitePassword }),
      }).then(async (response) => {
        const body = await response.json().catch(() => ({})) as {
          error?: string;
          requiresEmailConfirmation?: boolean;
          session?: { access_token: string; refresh_token: string } | null;
        };
        if (!response.ok) return { error: new Error(body.error ?? "運営アカウントの作成に失敗しました") };
        if (body.session) {
          await client.auth.setSession(body.session);
        }
        return { error: null, data: { session: body.session, requiresEmailConfirmation: body.requiresEmailConfirmation } };
      });

    if (result.error) {
      setMessage(result.error.message);
    } else if (mode === "signup") {
      setMessage("運営アカウントを作成しました。確認メールが届いたらリンクを開いてください。");
      if (result.data.session) router.replace(getNextPath());
    } else {
      router.replace(getNextPath());
    }
    setLoading(false);
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="operator-login-title">
        <a className={styles.backLink} href="/guest">← 参加者入口へ戻る</a>
        <div className={styles.brandRow}>
          <span className={styles.brandMark} aria-hidden="true">爆</span>
          <div>
            <p className={styles.brandName}>爆裂カジノ</p>
            <p className={styles.kicker}>キャンパスフェスティバル横浜キャンパス / STAFF AREA</p>
          </div>
        </div>
        <h1 id="operator-login-title">運営ログイン</h1>
        <p className={styles.lead}>QRコードの発行や景品受け取りを管理します。</p>

        <form className={styles.form} onSubmit={submit}>
          <label>
            <span>メールアドレス</span>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label>
            <span>パスワード</span>
            <input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
          {mode === "signup" ? (
            <label>
              <span>運営招待パスワード</span>
              <input type="password" required value={invitePassword} onChange={(event) => setInvitePassword(event.target.value)} autoComplete="off" />
            </label>
          ) : null}
          {message ? <p className={styles.message} role="alert">{message}</p> : null}
          <button className={styles.submitButton} type="submit" disabled={loading}>
            {loading ? "処理中…" : mode === "login" ? "ログイン" : "運営アカウントを作成"}
          </button>
        </form>

        <button className={styles.modeButton} type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setInvitePassword(""); setMessage(""); }}>
          {mode === "login" ? "運営アカウントを新規作成" : "ログインに戻る"}
        </button>
      </section>
    </main>
  );
}
