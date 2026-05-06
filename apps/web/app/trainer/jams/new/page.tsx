import { TrainerSessionListClient } from "../../../../components/trainer-session-list-client";
import { getServerSessionUser } from "../../../../lib/server-auth";
import { redirect } from "next/navigation";

export default async function TrainerNewJamPage() {
  const user = await getServerSessionUser();
  if (!user || (user.role !== "trainer" && user.role !== "admin")) {
    redirect("/trainer");
  }

  return (
    <main className="shell">
      <div className="container stack" style={{ maxWidth: 640, paddingTop: 40, paddingBottom: 60 }}>
        <TrainerSessionListClient sessions={[]} mode="create" />
      </div>
    </main>
  );
}
