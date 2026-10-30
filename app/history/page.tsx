import type { Metadata } from "next";
import { HistoryBoard } from "@/components/HistoryBoard";

export const metadata: Metadata = { title: "Past nights" };

export default function HistoryPage() {
  return <HistoryBoard />;
}
