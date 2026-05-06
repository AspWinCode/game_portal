import type { Route } from "next";
import { ChildEmptyState } from "../../../../components/child-empty-state";
import { ChildSessionSync } from "../../../../components/child-session-sync";
import { JamChooserClient } from "../../../../components/jam-chooser-client";
import { getParticipantProgress, listParticipantGames } from "../../../../lib/api";

export default async function ParticipantJamsPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;

  try {
    const [games, progressPayload] = await Promise.all([
      listParticipantGames(participantId),
      getParticipantProgress(participantId)
    ]);

    const joinCode = progressPayload.jam?.joinCode;
    const sessionTitle = progressPayload.jam?.title;

    if (!joinCode) {
      return (
        <main className="shell">
          <ChildEmptyState
            title="Сначала нужно войти в джем"
            description="Мы не нашли активный джем для этого участника. Вернись по join-ссылке и войди заново."
            primaryHref={"/" as Route}
            primaryLabel="На главную"
          />
        </main>
      );
    }

    if (!games.length) {
      return (
        <main className="shell">
          <ChildSessionSync
            session={{
              participantId,
              joinCode,
              sessionTitle,
              displayName: progressPayload.participant?.displayName,
              avatar: progressPayload.participant?.avatar
            }}
          />
          <ChildEmptyState
            title="Пока нет доступных игр"
            description="Тренер ещё не подключил опубликованную игру к этому джему. Обнови страницу позже или попроси тренера запустить миссию."
            primaryHref={`/join/${joinCode}` as Route}
            primaryLabel="Вернуться к джему"
            secondaryHref={"/trainer" as Route}
            secondaryLabel="Панель тренера"
          />
        </main>
      );
    }

    return (
      <main className="shell">
        <ChildSessionSync
          session={{
            participantId,
            joinCode,
            sessionTitle,
            displayName: progressPayload.participant?.displayName,
            avatar: progressPayload.participant?.avatar
          }}
        />
        <JamChooserClient participantId={participantId} jams={games} joinCode={joinCode} />
      </main>
    );
  } catch {
    return (
      <main className="shell">
        <ChildEmptyState
          title="Не удалось открыть выбор игры"
          description="Похоже, соединение прервалось или данные участника больше недоступны. Попробуй открыть join-ссылку ещё раз."
          primaryHref={"/" as Route}
          primaryLabel="Вернуться на главную"
        />
      </main>
    );
  }
}
