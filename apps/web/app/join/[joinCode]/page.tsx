import type { Route } from "next";
import { ChildEmptyState } from "../../../components/child-empty-state";
import { ChildResumeCard } from "../../../components/child-resume-card";
import { JoinSessionClient } from "../../../components/join-session-client";
import { getPublicJam } from "../../../lib/api";

export default async function JoinPage({ params }: { params: Promise<{ joinCode: string }> }) {
  const { joinCode } = await params;

  try {
    const payload = await getPublicJam(joinCode);

    return (
      <main className="shell">
        <div className="container stack" style={{ maxWidth: 560, paddingTop: 40 }}>
          <ChildResumeCard title="Продолжить текущий джем" />
          <JoinSessionClient
            joinCode={joinCode}
            session={payload.jam}
            organization={payload.organization}
            jams={payload.games}
            hasResumeOption
          />
        </div>
      </main>
    );
  } catch {
    return (
      <main className="shell">
        <ChildEmptyState
          title="Джем недоступен"
          description="Похоже, join code больше не активен или ссылка устарела. Попроси тренера отправить новую ссылку или код входа."
          primaryHref={"/" as Route}
          primaryLabel="Вернуться на главную"
          secondaryHref={"/trainer" as Route}
          secondaryLabel="Открыть панель тренера"
        />
      </main>
    );
  }
}
