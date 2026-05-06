import Link from "next/link";

export default function StatusPage() {
  return (
    <main className="shell">
      <div className="container stack">
        <section className="hero">
          <div className="eyebrow">Статус сервиса</div>
          <h1 style={{ fontSize: "clamp(36px, 6vw, 72px)", marginTop: 16 }}>Сервис работает</h1>
          <p className="subtle" style={{ maxWidth: 720 }}>
            Для локальной работы платформа запущена. Если вам нужен детальный технический health-check, используйте API
            по адресу <code>http://localhost:4000/api/health</code>.
          </p>
          <div className="button-row" style={{ marginTop: 20 }}>
            <span className="status-pill completed">в норме</span>
            <Link className="button-secondary" href="/account">
              Перейти в аккаунт
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
