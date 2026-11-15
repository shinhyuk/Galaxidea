import type { Metadata } from "next";
import Link from "next/link";
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
          <nav className="nav">
            <Link href="/">그래프</Link>
            <Link href="/mock">화면 시안</Link>
          </nav>
          <MockTag />
        </header>
        <main>{children}</main>
        <MockFooter />
      </body>
    </html>
  );
}
