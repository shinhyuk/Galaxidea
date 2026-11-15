import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
            <Link href="/">우주</Link>
            <Link href="/#trending">뜨는 영역</Link>
            <Link href="/#empty">빈 영역</Link>
          </nav>
          <span className="tag">더미 데이터</span>
        </header>
        <main>{children}</main>
        <footer className="foot">
          화면 구성을 보기 위한 시안입니다. 제품, 수치, 추세는 모두 지어낸
          예시이며 실제 검색 결과가 아닙니다.
        </footer>
      </body>
    </html>
  );
}
