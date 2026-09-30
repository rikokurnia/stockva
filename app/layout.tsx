import type { Metadata } from "next";
import "./globals.css";
import Providers from "../components/providers";

export const metadata: Metadata = {
  title: "Stockva — Build your portfolio. Shape your city.",
  description:
    "Turn your stock portfolio into a living city. Explore real-world stocks, build your island, and learn by playing in Stockva's city-building demo.",
  icons: {
    icon: "/assets/ai_logo.png",
    shortcut: "/assets/ai_logo.png",
    apple: "/assets/ai_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
