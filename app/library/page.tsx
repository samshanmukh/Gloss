import type { Metadata } from "next";
import LibraryWorkspace from "@/components/LibraryWorkspace";

export const metadata: Metadata = {
  title: "Research Library | Gloss",
  description: "Manage private PDFs, included papers, reading progress, notes, and connected concepts.",
};

export default function LibraryPage() {
  return <LibraryWorkspace />;
}
