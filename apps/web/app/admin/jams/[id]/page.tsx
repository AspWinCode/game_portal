import { redirect } from "next/navigation";

// Route renamed to /admin/games/[id]
export default async function RedirectAdminJamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/games/${id}`);
}
