import type { Metadata } from "next";
import KnowledgeWorkspace from "@/components/KnowledgeWorkspace";

export const metadata: Metadata = {
  title: "Knowledge Studio | Gloss",
  description: "Explore and interact with your connected understanding across papers and notes.",
};

export default function KnowledgePage() {
  return <KnowledgeWorkspace />;
}
