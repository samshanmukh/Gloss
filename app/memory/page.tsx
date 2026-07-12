import type { Metadata } from "next";
import MemoryWorkspace from "@/components/MemoryWorkspace";

export const metadata: Metadata = {
  title: "Memory Studio | Gloss",
  description: "Explore confirmed concepts, reading notes, learner preferences, and EverOS hybrid memory.",
};

export default function MemoryPage() {
  return <MemoryWorkspace />;
}
