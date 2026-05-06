"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { InvitePreviewPayload } from "@game-game/shared";
import { acceptInvite, login } from "../lib/auth";

interface InviteAcceptClientProps {
  invite: InvitePreviewPayload;
}

export function InviteAcceptClient({ invite }: InviteAcceptClientProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!invite.isValid) {
      setError("Этот инвайт больше не активен.");
      return;
    }
    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Подтверждение пароля не совпадает.");
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await acceptInvite(invite.token, displayName, password);
      await login(invite.email, password);
      setSuccess("Инвайт принят. Перенаправляю в рабочее пространство...");
      router.push("/account");
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Не удалось принять инвайт.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card stack">
      <div className="eyebrow">Инвайт</div>
      <h1 style={{ margin: 0, fontSize: 32 }}>Присоединение к организации</h1>
      <p className="subtle" style={{ margin: 0 }}>
        {invite.organization.name} приглашает вас как <strong>{invite.role}</strong>.
      </p>

      {invite.organization.logoUrl ? (
        <img
          src={invite.organization.logoUrl}
          alt={`Логотип ${invite.organization.name}`}
          style={{ width: 72, height: 72, borderRadius: 18, objectFit: "cover" }}
        />
      ) : null}

      <div
        className="card"
        style={{
          padding: 16,
          borderColor: invite.organization.brandAccentColor ? `${invite.organization.brandAccentColor}55` : undefined
        }}
      >
        <strong>{invite.organization.name}</strong>
        <p className="subtle" style={{ marginBottom: 0 }}>
          {invite.organization.brandMessage ?? "После принятия инвайта вы сразу попадёте в аккаунт и сможете выбрать рабочую организацию."}
        </p>
      </div>

      <div className="button-row" style={{ flexWrap: "wrap" }}>
        <span className="pill">email: {invite.email}</span>
        <span className={`status-pill ${invite.isValid ? "completed" : "locked"}`}>{invite.isValid ? "инвайт активен" : "инвайт неактивен"}</span>
        <span className="pill">истекает {new Date(invite.expiresAt).toLocaleString("ru-RU")}</span>
      </div>

      {invite.isValid ? (
        <form className="stack" onSubmit={handleSubmit}>
          <label className="stack">
            <span>Как вас показать в системе</span>
            <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
          <label className="stack">
            <span>Пароль</span>
            <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <label className="stack">
            <span>Подтверждение пароля</span>
            <input className="input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </label>
          <button className="button" type="submit" disabled={pending}>
            {pending ? "Подключаю..." : "Принять инвайт и войти"}
          </button>
        </form>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <strong>Инвайт недоступен</strong>
          <p className="subtle" style={{ marginBottom: 0 }}>
            Ссылка могла истечь, быть отозвана или организация сейчас неактивна. Попросите администратора выслать новый инвайт.
          </p>
        </div>
      )}

      {error ? <p style={{ color: "#fda4af", margin: 0 }}>{error}</p> : null}
      {success ? <p style={{ color: "#86efac", margin: 0 }}>{success}</p> : null}
    </section>
  );
}
