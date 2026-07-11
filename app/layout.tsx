import type { Metadata } from "next";
import "pdfjs-dist/web/pdf_viewer.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gloss — Read. Understand. Remember.",
  description:
    "A memory-native research reading tutor with grounded AI explanations, private PDF rendering, persistent notes, and a living knowledge graph.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
