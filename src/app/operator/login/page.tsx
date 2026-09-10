"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

export default function OperatorLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/operator");
    });
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/operator/login`,
        },
      });

    if (result.error) {
      setMessage(result.error.message);
    } else if (mode === "signup") {
      setMessage("運営アカウントを作成しました。確認メールが必要な場合はメールを確認してください。");
      if (result.data.session) router.replace("/operator");
    } else {
      router.replace("/operator");
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
        <p className={styles.lead}>QRコードの発行やビンゴ進行を管理します。</p>

        <form className={styles.form} onSubmit={submit}>
          <label>
            <span>メールアドレス</span>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label>
            <span>パスワード</span>
            <input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
          {message ? <p className={styles.message} role="alert">{message}</p> : null}
          <button className={styles.submitButton} type="submit" disabled={loading}>
            {loading ? "処理中…" : mode === "login" ? "ログイン" : "運営アカウントを作成"}
          </button>
        </form>

        <button className={styles.modeButton} type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
          {mode === "login" ? "運営アカウントを新規作成" : "ログインに戻る"}
        </button>
      </section>
    </main>
  );
}
