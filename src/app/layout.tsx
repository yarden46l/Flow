import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

// ── Viewport / PWA chrome ─────────────────────────────────────────────────────
export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

// ── App metadata ──────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "KaizenFlow — Capture, Align, Execute",
  description:
    "A premium self-management framework utilizing GTD, Time Blocking, Spaced Repetition, and Kaizen continuous improvement.",
  applicationName: "KaizenFlow",
  keywords: ["productivity", "GTD", "time blocking", "kaizen", "focus"],
  authors: [{ name: "KaizenFlow" }],
  // PWA manifest
  manifest: "/manifest.json",
  // Apple / iOS PWA support
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KaizenFlow",
    startupImage: ["/icons/icon-512.png"],
  },
  // Open Graph (share cards)
  openGraph: {
    type: "website",
    title: "KaizenFlow — Capture, Align, Execute",
    description:
      "A premium self-management framework utilizing GTD, Time Blocking, Spaced Repetition, and Kaizen continuous improvement.",
    siteName: "KaizenFlow",
  },
  // Icons
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
    shortcut: "/icons/icon-192.png",
  },
};

import PWARegister from "@/components/PWARegister";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        {/* ms-application for Windows tiles */}
        <meta name="msapplication-TileColor" content="#4f46e5" />
        <meta name="msapplication-TileImage" content="/icons/icon-192.png" />
        {/* Prevent tap highlight on mobile */}
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-white text-zinc-900 overflow-x-hidden">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
