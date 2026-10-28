import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OAuth Field Guide",
  description: "How hard is it to get an OAuth app approved? Evidence-backed setup guides for 100 apps, plus live agent research for any other.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <header className="no-print border-b border-line bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-bold text-white">OA</span>
              OAuth Field Guide
            </Link>
            <nav className="flex items-center gap-5 text-sm text-muted">
              <Link href="/" className="hover:text-ink">Library</Link>
              <Link href="/methodology" className="hover:text-ink">How it works</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
