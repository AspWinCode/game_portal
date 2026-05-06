import Link from "next/link";
import { AuthClient } from "../../components/auth-client";

export default function AccountPage() {
  return (
    <main className="shell">
      <div className="container stack">
        <section className="hero">
          <div className="eyebrow">Аккаунт</div>
          <h1 style={{ fontSize: 48, marginTop: 16 }}>Профиль и безопасность</h1>
          <p className="subtle" style={{ maxWidth: 720 }}>
            Здесь можно войти в систему, открыть рабочую область, сменить пароль и посмотреть активные сессии.
          </p>
          <div className="button-row">
            <Link className="button-secondary" href="/admin">
              Админка
            </Link>
            <Link className="button-secondary" href="/trainer">
              Тренер
            </Link>
          </div>
        </section>
        <AuthClient />
      </div>
    </main>
  );
}
