import type { Metadata } from "next";
import GlossApp from "@/components/GlossApp";

export const metadata: Metadata = {
  title: "Reader | Gloss",
  description: "Read papers with grounded AI explanations and persistent learner memory.",
};

export default function ReaderPage() {
  return <GlossApp />;
}
