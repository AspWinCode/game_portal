import { OrganizationOnboardingClient } from "../../../../../components/organization-onboarding-client";
import { getAdminOrganizationOnboarding } from "../../../../../lib/api";
import { getServerCookieHeader, requireServerRole } from "../../../../../lib/server-auth";

interface OrganizationOnboardingPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrganizationOnboardingPage({ params }: OrganizationOnboardingPageProps) {
  await requireServerRole("admin", "/account");
  const { id } = await params;
  const cookieHeader = await getServerCookieHeader();
  const payload = await getAdminOrganizationOnboarding(id, cookieHeader ?? undefined).catch(() => null);

  return (
    <main className="shell">
      <div className="container stack">
        {payload ? (
          <OrganizationOnboardingClient payload={payload} />
        ) : (
          <section className="card stack">
            <div className="eyebrow">Запуск организации</div>
            <h1 style={{ margin: 0, fontSize: 32 }}>Организация не найдена</h1>
            <p className="subtle" style={{ marginBottom: 0 }}>
              Не удалось загрузить чеклист запуска для этой организации.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
