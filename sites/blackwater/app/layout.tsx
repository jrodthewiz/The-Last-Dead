import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Last Dead · Blackwater",
  description: "An N64-inspired open-world horror survival adventure. Find a second survivor and restore Blackwater’s signal together.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
