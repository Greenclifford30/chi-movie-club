import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { AuthProvider } from "@/lib/auth-context";

const geist = localFont({ src: "../public/fonts/geist-latin.woff2", display: "swap", variable: "--font-geist" });

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "Movie Club",
  description: "Choose a movie, plan the night, and go together.",
  openGraph: { title: "Movie Club", description: "Choose a movie, plan the night, and go together.", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
