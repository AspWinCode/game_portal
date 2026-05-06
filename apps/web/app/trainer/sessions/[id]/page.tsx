import { redirect } from "next/navigation";

// Route renamed to /trainer/jams/[id]
export default async function RedirectTrainerSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/trainer/jams/${id}`);
}
