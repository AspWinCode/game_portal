import { InviteAcceptClient } from "../../../components/invite-accept-client";
import { getInvitePreview } from "../../../lib/auth";

interface InvitePageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invite = await getInvitePreview(token).catch(() => null);

  return (
    <main className="shell">
      <div className="container stack">
        {invite ? (
          <InviteAcceptClient invite={invite} />
        ) : (
          <section className="card stack">
            <div className="eyebrow">Invite</div>
            <h1 style={{ margin: 0, fontSize: 32 }}>Инвайт не найден</h1>
            <p className="subtle" style={{ marginBottom: 0 }}>
              Ссылка недоступна. Попросите администратора отправить новый инвайт в организацию.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
