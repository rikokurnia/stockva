import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Stockva — City Builder",
  description:
    "An empty-island city builder. Draw roads and place every stock building yourself in a local frontend sandbox.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
