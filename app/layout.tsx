import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Galaxidea",
  description: "내 아이디어는 우주 어디쯤에 있을까",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
