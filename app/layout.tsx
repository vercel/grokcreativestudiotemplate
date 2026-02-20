import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GeistPixelSquare } from "geist/font/pixel";

import { DeferredAnalytics } from "@/components/deferred-analytics";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Grok Creative Studio",
  description:
    "Generate images and video with Grok AI. A minimal creative playground powered by xAI.",
  openGraph: {
    title: "Grok Creative Studio",
    description:
      "Generate images and video with Grok AI. A minimal creative playground powered by xAI.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Grok Creative Studio",
    description:
      "Generate images and video with Grok AI. A minimal creative playground powered by xAI.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} ${GeistPixelSquare.variable} font-sans antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `document.addEventListener('contextmenu',function(e){var t=e.target;if(t&&(t.tagName==='IMG'||t.tagName==='VIDEO'))e.preventDefault()})`,
          }}
        />
        {children}
        <DeferredAnalytics />
      </body>
    </html>
  );
}
