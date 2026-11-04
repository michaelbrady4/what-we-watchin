import type { Metadata } from "next";
import { SessionRoom } from "@/components/SessionRoom";
import { getSession } from "@/lib/sessions";
import { displayNightName } from "@/lib/text";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const normalized = code.toLowerCase();
  try {
    const view = await getSession(normalized, null);
    return { title: view?.displayName ?? displayNightName(null, normalized) };
  } catch {
    return { title: displayNightName(null, normalized) };
  }
}

export default async function SessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SessionRoom code={code.toLowerCase()} />;
}
