import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Site-wide metadata. `metadataBase` is what turns the file-convention OG and
 * Twitter images into the absolute URLs link-preview crawlers require; the
 * image itself is the static branded card in `app/opengraph-image.tsx`, shared
 * by every route including `/insights/[coords]`, which overrides only the title
 * and description.
 */
export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: SITE_NAME,
  description: SITE_TAGLINE,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_TAGLINE,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_TAGLINE,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
