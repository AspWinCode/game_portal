"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { exitSupportMode, getMe, login, loginAs, logout, type SessionUser } from "../lib/auth";

function roleWorkspacePath(role: SessionUser["role"]) {
  return role === "admin" ? "/admin" : role === "trainer" ? "/trainer" : "/";
}

function roleLabel(role: SessionUser["role"]) {
  if (role === "admin") return "администратор";
  if (role === "trainer") return "тренер";
  return "участник";
}

export function AuthClient() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);

  const workspacePath = useMemo(() => (user ? roleWorkspacePath(user.role) : "/"), [user]);

  async function refreshSessionState() {
    const session = await getMe();
    setUser(session.user);
  }

  useEffect(() => {
    refreshSessionState()
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function runAction(action: () => Promise<void>, fallbackMessage: string) {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : fallbackMessage);
    } finally {
      setPending(false);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    await runAction(async () => {
      await login(email, password);
      await refreshSessionState();
    }, "Не удалось войти. Проверьте email и пароль.");
  }

  async function handleQuickLogin(role: "admin" | "trainer") {
    await runAction(async () => {
      await loginAs(role);
      await refreshSessionState();
      setEmail(role === "admin" ? "admin@example.com" : "trainer@example.com");
      setPassword(role === "admin" ? "admin123" : "trainer123");
    }, "Не удалось выполнить быстрый вход.");
  }

  async function handleLogout() {
    await runAction(async () => {
      await logout();
      setUser(null);
    }, "Не удалось выйти из системы.");
  }

  async function handleExitSupportMode() {
    await runAction(async () => {
      await exitSupportMode();
      await refreshSessionState();
    }, "Не удалось выйти из режима поддержки.");
  }

  if (loading) {
    return (
      <section className="card stack">
        <div className="eyebrow">Аккаунт</div>
        <p className="subtle" style={{ margin: 0 }}>
          Проверяю текущую сессию...
        </p>
      </section>
    );
  }

  return (
    <section className="card stack">
      <div>
        <div className="eyebrow">Аккаунт</div>
        <h2 className="section-title" style={{ fontSize: 28, marginTop: 10 }}>
          Вход и рабочая область
        </h2>
      </div>

      {user ? (
        <>
          {user.supportMode ? (
            <div className="card accent-card stack" style={{ padding: 16 }}>
              <strong>Режим поддержки включён</strong>
              <p className="subtle" style={{ margin: 0 }}>
                Сейчас вы работаете от имени пользователя {user.displayName}.
              </p>
              <div className="button-row">
                <button className="button-secondary" onClick={handleExitSupportMode} disabled={pending}>
                  Выйти из режима поддержки
                </button>
              </div>
            </div>
          ) : null}

          <div className="card stack" style={{ padding: 16 }}>
            <strong>{user.displayName}</strong>
            <p className="subtle" style={{ margin: 0 }}>
              {user.email} · роль: {roleLabel(user.role)}
            </p>
            {user.currentOrganizationName ? (
              <p className="subtle" style={{ margin: 0 }}>
                Рабочая группа: {user.currentOrganizationName}
              </p>
            ) : null}
          </div>

          <div className="button-row">
            <Link className="button" href={workspacePath}>
              Открыть рабочую область
            </Link>
            <button className="button-secondary" onClick={handleLogout} disabled={pending}>
              Выйти
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="subtle" style={{ margin: 0 }}>
            Войдите под учётной записью администратора или тренера.
          </p>

          <form className="stack" onSubmit={handleLogin}>
            <label className="stack">
              <span>Email</span>
              <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="stack">
              <span>Пароль</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="button" type="submit" disabled={pending}>
              {pending ? "Вхожу..." : "Войти"}
            </button>
          </form>

          <div className="button-row">
            <button className="button-secondary" onClick={() => handleQuickLogin("admin")} disabled={pending}>
              Войти как админ
            </button>
            <button className="button-secondary" onClick={() => handleQuickLogin("trainer")} disabled={pending}>
              Войти как тренер
            </button>
          </div>
        </>
      )}

      {error ? <p style={{ color: "#fda4af", margin: 0 }}>{error}</p> : null}
    </section>
  );
}
