import type { Metadata } from "next";
import { SessionRoom } from "@/components/SessionRoom";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return { title: `Night ${code.toLowerCase()}` };
}

export default async function SessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SessionRoom code={code.toLowerCase()} />;
}
