import type { Metadata } from "next";
import "pdfjs-dist/web/pdf_viewer.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gloss — Read. Understand. Remember.",
  description: "A reading tutor that builds on what you already know.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
