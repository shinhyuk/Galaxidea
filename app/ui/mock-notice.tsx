"use client";

import { usePathname } from "next/navigation";

// The home page shows real data; every other page is still a layout
// mock-up filled with invented content, and says so.
export function MockTag() {
  return usePathname() === "/" ? null : <span className="tag">더미 데이터</span>;
}

export function MockFooter() {
  return usePathname() === "/" ? null : (
    <footer className="foot">
      화면 구성을 보기 위한 시안입니다. 제품, 수치, 추세는 모두 지어낸
      예시이며 실제 검색 결과가 아닙니다.
    </footer>
  );
}
