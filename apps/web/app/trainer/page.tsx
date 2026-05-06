import { AuthClient } from "../../components/auth-client";
import { TrainerSessionListClient } from "../../components/trainer-session-list-client";
import { getTrainerJams } from "../../lib/api";
import { getServerCookieHeader, getServerSessionUser } from "../../lib/server-auth";

export default async function TrainerLandingPage() {
  const cookieHeader = await getServerCookieHeader();
  const user = await getServerSessionUser();

  let jams: Awaited<ReturnType<typeof getTrainerJams>> = [];
  let loadError: string | null = null;

  const hasAccess = user?.role === "trainer" || user?.role === "admin";

  if (hasAccess) {
    try {
      jams = await getTrainerJams(cookieHeader ?? undefined);
    } catch {
      loadError = "Не удалось загрузить данные тренера. Обновите страницу.";
    }
  }

  return (
    <main className="shell">
      <div className="container stack">
        <section className="hero">
          <div className="eyebrow">ТРЕНЕРСКАЯ ЗОНА</div>
          <h1 style={{ fontSize: 48, marginTop: 16 }}>Панель тренера</h1>
          <p className="subtle">
            Здесь создаются джемы (сессии) и выбираются игры, которые входят в джем.
          </p>
        </section>

        {hasAccess ? (
          <>
            {loadError ? (
              <section className="card stack">
                <p style={{ margin: 0, color: "var(--danger)" }}>{loadError}</p>
              </section>
            ) : (
              <TrainerSessionListClient sessions={jams} />
            )}
          </>
        ) : (
          <section className="card stack">
            <h2 style={{ margin: 0, fontSize: 24 }}>Требуется вход</h2>
            <p className="subtle" style={{ margin: 0 }}>
              Войдите под учётной записью тренера или администратора.
            </p>
            <AuthClient />
          </section>
        )}
      </div>
    </main>
  );
}
