"use client";

import { usePathname } from "next/navigation";

// The graph and real reports show real data; the pages under /mock, /d and
// /c are still layout mock-ups filled with invented content, and say so.
function useIsMock() {
  return /^\/(mock|d|c)(\/|$)/.test(usePathname());
}

export function MockTag() {
  return useIsMock() ? <span className="tag">더미 데이터</span> : null;
}

export function MockFooter() {
  return !useIsMock() ? null : (
    <footer className="foot">
      화면 구성을 보기 위한 시안입니다. 제품, 수치, 추세는 모두 지어낸
      예시이며 실제 검색 결과가 아닙니다.
    </footer>
  );
}
