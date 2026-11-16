import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import { MockFooter, MockTag } from "./ui/mock-notice";

export const metadata: Metadata = {
  title: "Galaxidea",
  description: "내 아이디어는 우주 어디쯤에 있을까",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>
        <header className="top">
          <Link href="/" className="brand">
            <span className="mark">Galaxidea</span>
            <span className="ko">갤럭시디아</span>
          </Link>
          {/* Reads the URL, which a page with a runtime address only knows per request. */}
          <Suspense fallback={null}>
            <MockTag />
          </Suspense>
        </header>
        <main>{children}</main>
        <Suspense fallback={null}>
          <MockFooter />
        </Suspense>
      </body>
    </html>
  );
}
