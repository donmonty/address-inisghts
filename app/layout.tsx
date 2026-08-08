import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { socialMetadata, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
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
 * Site-wide metadata. `metadataBase` is the only reason the social card's URL
 * comes out absolute, which is the one thing every link-preview crawler
 * requires; the card itself is drawn in `app/opengraph-image.tsx`.
 */
export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: SITE_NAME,
  description: SITE_TAGLINE,
  ...socialMetadata({
    title: SITE_NAME,
    description: SITE_TAGLINE,
    url: "/",
  }),
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
