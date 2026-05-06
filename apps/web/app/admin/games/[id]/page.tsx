import { AdminJamWizardClient } from "../../../../components/admin-jam-wizard-client";
import { getAdminGameDetail, getAdminMediaAssets } from "../../../../lib/api";
import { getServerCookieHeader, requireServerRole } from "../../../../lib/server-auth";

function hasSequentialHints(levels: number[]) {
  return [...levels].sort((left, right) => left - right).join(",") === "1,2,3";
}

export default async function AdminGamePage({ params }: { params: Promise<{ id: string }> }) {
  await requireServerRole("admin", "/admin");
  const cookieHeader = await getServerCookieHeader();
  const { id } = await params;
  const detail = await getAdminGameDetail(id, cookieHeader ?? undefined);
  const recentAssets = await getAdminMediaAssets(cookieHeader ?? undefined);

  const isTemplate = detail.game.isTemplate;

  const blockingChecks = [
    { label: "Игра не в архиве", passed: detail.game.status !== "archived" },
    { label: "Есть хотя бы один шаг", passed: detail.steps.length > 0 },
    {
      label: "Заполнены название, краткое и полное описание",
      passed: Boolean(detail.game.title.trim() && detail.game.shortDescription.trim() && detail.game.fullDescription.trim())
    },
    {
      label: "Тема, уровень, стиль и длительность указаны",
      passed: Boolean(
        detail.game.themeCode.trim() &&
          detail.game.level.trim() &&
          detail.game.accentStyle.trim() &&
          detail.game.accentColor.trim() &&
          detail.game.estimatedDurationMin >= 15 &&
          detail.game.estimatedDurationMin <= 90
      )
    },
    {
      label: "Финальный экран заполнен и XP > 0",
      passed: Boolean(detail.game.finalTitle.trim() && detail.game.finalDescription.trim() && detail.game.finalRewardXp > 0)
    },
    {
      label: "У каждого шага есть заголовок, описание и цель",
      passed: detail.steps.length > 0 && detail.steps.every((step) => step.title.trim() && step.description.trim() && step.goalText.trim())
    },
    {
      label: "Блок успеха и XP заполнены для каждого шага",
      passed: detail.steps.length > 0 && detail.steps.every((step) => step.successTitle.trim() && step.successText.trim() && step.successXp > 0)
    },
    {
      label: "У каждого шага ровно 3 подсказки (L1, L2, L3)",
      passed: detail.steps.length > 0 && detail.steps.every((step) => step.hints.length === 3 && hasSequentialHints(step.hints.map((h) => h.level)))
    },
    {
      label: "Порядок шагов последовательный",
      passed: detail.steps.length > 0 && detail.steps.every((step, i) => step.orderIndex === i + 1)
    }
  ];

  const advisoryChecks = [
    { label: "Обложка добавлена", passed: Boolean(detail.game.coverImageUrl) },
    { label: "Preview-видео добавлено", passed: Boolean(detail.game.previewVideoUrl) },
    {
      label: "Есть итоговое медиа хотя бы у одного шага",
      passed: detail.steps.some((step) => step.resultImageUrl || step.resultVideoUrl)
    }
  ];

  const publishReady = blockingChecks.every((item) => item.passed);
  const nextVersionNumber = Math.max(0, ...detail.versions.map((v) => v.versionNumber)) + 1;

  return (
    <main className="shell">
      <div className="container stack">
        <AdminJamWizardClient
          detail={detail}
          recentAssets={recentAssets}
          blockingChecks={blockingChecks}
          advisoryChecks={advisoryChecks}
          publishReady={publishReady}
          nextVersionNumber={nextVersionNumber}
          isTemplate={isTemplate}
        />
      </div>
    </main>
  );
}
