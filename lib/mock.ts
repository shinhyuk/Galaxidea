// Dummy data for laying out the screens before the real API exists (M3, M4).
// Everything here is invented for display. The shapes follow what the pages
// will later receive from the database.

export type ClusterState = "steady" | "growing" | "saturated" | "fading";
export type Verdict = "exists" | "similar" | "rare";

export type Product = {
  name: string;
  oneLiner: string;
  launched: string | null;
  status: string;
  url: string | null;
  similarity: number;
};

export type Cluster = {
  id: string;
  label: string;
  state: ClusterState;
  // Position and size on the universe map, as fractions of the canvas.
  x: number;
  y: number;
  r: number;
  itemCount: number;
  queryCount: number;
  weeklyNewItems: number;
  growthScore: number;
  weeklyLaunches: number[];
  weeklyQueries: number[];
  products: Product[];
};

export type EmptyArea = {
  id: string;
  label: string;
  trendScore: number;
  itemCount: number;
  queryCount: number;
  words: string[];
  x: number;
  y: number;
  r: number;
};

export type Report = {
  id: string;
  oneLiner: string;
  verdict: Verdict;
  summary: string;
  clusterId: string | null;
  emptyAreaId: string | null;
  star: { x: number; y: number };
  products: Product[];
  sameIdea: {
    count: number;
    firstAt: string;
    langs: { label: string; count: number }[];
  };
  trends: { word: string; change: number; series: number[] }[];
};

export const WEEKS = [
  "8/24", "8/31", "9/7", "9/14", "9/21", "9/28",
  "10/5", "10/12", "10/19", "10/26", "11/2", "11/9",
];

export const STATE_LABEL: Record<ClusterState, string> = {
  steady: "잔잔함",
  growing: "뻗는 중",
  saturated: "포화",
  fading: "식는 중",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  exists: "이미 있음",
  similar: "비슷한 것 있음",
  rare: "거의 없음",
};

function product(
  name: string,
  oneLiner: string,
  launched: string | null,
  status: string,
  similarity: number,
): Product {
  return { name, oneLiner, launched, status, url: "https://example.com", similarity };
}

export const clusters: Cluster[] = [
  {
    id: "agent",
    label: "AI 에이전트 비서",
    state: "saturated",
    x: 0.27, y: 0.25, r: 0.17,
    itemCount: 412, queryCount: 96, weeklyNewItems: 21, growthScore: 1.1,
    weeklyLaunches: [14, 17, 15, 19, 18, 22, 20, 19, 23, 18, 20, 21],
    weeklyQueries: [3, 5, 4, 7, 6, 9, 8, 11, 9, 12, 10, 12],
    products: [
      product("피클(Pickle)", "전화, 쇼핑 결제, 예매를 대신하는 개인 AI 에이전트 앱", "2026년 3월", "운영 중", 0.84),
      product("메타 뮤즈", "개인 AI 에이전트", "2026년 9월", "운영 중", 0.81),
      product("오픈AI 닷츠", "24시간 스스로 움직이는 AI 비서", "2026년 6월", "운영 중", 0.79),
      product("예시 제품 가", "일정과 메일을 대신 정리하는 비서", "2025년 11월", "운영 중", 0.72),
      product("예시 제품 나", "식당 예약 전화를 대신 거는 봇", null, "중단", 0.69),
    ],
  },
  {
    id: "dating",
    label: "AI 소개팅",
    state: "saturated",
    x: 0.76, y: 0.2, r: 0.11,
    itemCount: 87, queryCount: 31, weeklyNewItems: 3, growthScore: 0.8,
    weeklyLaunches: [5, 4, 6, 4, 3, 5, 4, 3, 4, 2, 3, 3],
    weeklyQueries: [2, 3, 2, 4, 3, 2, 3, 4, 2, 3, 3, 3],
    products: [
      product("미러", "양쪽 AI가 먼저 대화하고 궁합 분석을 보여 주는 데이팅 앱", "2026년 7월", "운영 중", 0.86),
      product("노운(Known)", "AI가 전화 인터뷰로 성향을 파악해 상대를 골라 주는 앱", "2025년 12월", "운영 중", 0.78),
      product("예시 제품 다", "대화 기록으로 첫 메시지를 써 주는 도우미", "2025년 5월", "운영 중", 0.66),
    ],
  },
  {
    id: "idea",
    label: "아이디어 검색",
    state: "growing",
    x: 0.72, y: 0.6, r: 0.14,
    itemCount: 58, queryCount: 44, weeklyNewItems: 9, growthScore: 2.4,
    weeklyLaunches: [1, 2, 2, 3, 2, 4, 3, 5, 4, 6, 7, 9],
    weeklyQueries: [1, 1, 2, 2, 4, 3, 5, 6, 5, 8, 9, 11],
    products: [
      product("Prexist", "프로덕트헌트, YC, 깃허브, 앱스토어 등 8곳에서 비슷한 제품을 찾아 주는 도구", "2026년 4월", "운영 중", 0.77),
      product("DoesItExist", "아이디어를 입력하면 비슷한 제품을 보여 주는 검색", "2025년 8월", "운영 중", 0.74),
      product("예시 제품 라", "특허 공개 문서를 한 줄 요약으로 찾아 주는 검색", "2026년 2월", "운영 중", 0.63),
      product("예시 제품 마", "창업 아이디어를 점수로 평가하는 봇", null, "중단", 0.58),
    ],
  },
  {
    id: "audio",
    label: "오디오 게임",
    state: "growing",
    x: 0.24, y: 0.66, r: 0.11,
    itemCount: 39, queryCount: 17, weeklyNewItems: 5, growthScore: 1.9,
    weeklyLaunches: [1, 0, 2, 1, 2, 2, 3, 2, 3, 4, 4, 5],
    weeklyQueries: [0, 1, 1, 0, 2, 1, 2, 3, 2, 3, 4, 4],
    products: [
      product("GMA", "화면 없이 소리만으로 하는 2인용 잠수함 대전", "2011년", "중단", 0.74),
      product("FAD", "무선 교신만 듣고 수중 미로를 빠져나가는 오디오 게임", "2019년", "운영 중", 0.71),
      product("Submarine Sonar", "소나를 쓰지만 화면 중심인 모바일 게임", "2022년", "운영 중", 0.66),
      product("예시 제품 바", "눈을 감고 하는 리듬 게임", "2024년 6월", "운영 중", 0.57),
      product("예시 제품 사", "음성 명령만으로 진행하는 추리 게임", null, "개발 중", 0.52),
    ],
  },
  {
    id: "local-llm",
    label: "로컬 LLM 도구",
    state: "growing",
    x: 0.5, y: 0.43, r: 0.09,
    itemCount: 203, queryCount: 52, weeklyNewItems: 26, growthScore: 1.7,
    weeklyLaunches: [11, 12, 14, 13, 15, 17, 16, 19, 21, 22, 24, 26],
    weeklyQueries: [2, 3, 3, 4, 5, 4, 6, 7, 6, 8, 9, 9],
    products: [
      product("예시 제품 아", "내 컴퓨터에서 모델을 내려받아 실행하는 도구", "2024년 2월", "운영 중", 0.8),
      product("예시 제품 자", "로컬 모델용 채팅 화면", "2024년 9월", "운영 중", 0.76),
      product("예시 제품 차", "노트북에서 도는 음성 받아쓰기", "2025년 4월", "운영 중", 0.64),
    ],
  },
  {
    id: "meeting",
    label: "음성 회의록",
    state: "growing",
    x: 0.9, y: 0.88, r: 0.07,
    itemCount: 124, queryCount: 28, weeklyNewItems: 12, growthScore: 1.5,
    weeklyLaunches: [6, 7, 6, 8, 7, 9, 8, 10, 9, 11, 10, 12],
    weeklyQueries: [1, 2, 1, 2, 3, 2, 3, 3, 4, 3, 4, 5],
    products: [
      product("예시 제품 카", "회의를 녹음해 요약과 할 일을 뽑아 주는 앱", "2023년 10월", "운영 중", 0.82),
      product("예시 제품 타", "통화 내용을 받아 적는 도구", "2025년 1월", "운영 중", 0.7),
    ],
  },
  {
    id: "pet-health",
    label: "반려동물 건강 기록",
    state: "growing",
    x: 0.9, y: 0.43, r: 0.06,
    itemCount: 66, queryCount: 19, weeklyNewItems: 7, growthScore: 1.3,
    weeklyLaunches: [4, 5, 4, 5, 6, 5, 6, 5, 6, 6, 7, 7],
    weeklyQueries: [1, 1, 2, 1, 2, 2, 3, 2, 3, 3, 3, 4],
    products: [
      product("예시 제품 거", "산책과 식사, 병원 기록을 한곳에 모으는 앱", "2024년 5월", "운영 중", 0.75),
      product("예시 제품 너", "사진으로 피부 상태를 살펴 주는 도구", "2025년 9월", "운영 중", 0.68),
    ],
  },
];

export const emptyAreas: EmptyArea[] = [
  { id: "kimchi", label: "김치 숙성 센서", trendScore: 78, itemCount: 2, queryCount: 9, words: ["김치냉장고", "발효", "숙성도"], x: 0.5, y: 0.87, r: 0.075 },
  { id: "plant", label: "반려식물 진단", trendScore: 71, itemCount: 4, queryCount: 12, words: ["식집사", "과습", "잎 마름"], x: 0.08, y: 0.42, r: 0.05 },
  { id: "elder-call", label: "어르신 말벗 전화", trendScore: 66, itemCount: 3, queryCount: 7, words: ["독거", "안부 전화", "돌봄"], x: 0.52, y: 0.08, r: 0.05 },
  { id: "tool-share", label: "동네 공구 대여", trendScore: 59, itemCount: 5, queryCount: 6, words: ["전동 드릴", "셀프 인테리어"], x: 0.93, y: 0.45, r: 0.045 },
  { id: "sleep-sound", label: "수면 소리 분석", trendScore: 54, itemCount: 6, queryCount: 5, words: ["코골이", "수면 무호흡"], x: 0.1, y: 0.92, r: 0.045 },
];

export const reports: Report[] = [
  {
    id: "1",
    oneLiner: "소리만으로 하는 잠수함 게임",
    verdict: "similar",
    summary:
      "재미는 여러 번 확인됐고, 완성도 있게 다듬은 모바일 제품은 검색에서 보이지 않았습니다.",
    clusterId: "audio",
    emptyAreaId: null,
    star: { x: 0.31, y: 0.7 },
    products: clusters[3].products,
    sameIdea: {
      count: 17,
      firstAt: "2026년 9월 2일",
      langs: [
        { label: "한국어", count: 9 },
        { label: "영어", count: 6 },
        { label: "일본어", count: 2 },
      ],
    },
    trends: [
      { word: "오디오 게임", change: 0.42, series: [12, 13, 12, 15, 14, 17, 16, 19, 18, 21, 22, 24] },
      { word: "접근성 게임", change: 0.18, series: [20, 19, 21, 20, 22, 21, 23, 22, 24, 23, 25, 26] },
      { word: "소나", change: -0.07, series: [9, 10, 9, 8, 9, 8, 8, 9, 8, 7, 8, 8] },
    ],
  },
  {
    id: "2",
    oneLiner: "AI끼리 먼저 대화하는 소개팅",
    verdict: "exists",
    summary:
      "같은 구조의 제품이 이미 나와 있습니다. 연애가 아닌 반복 수요로 옮기면 빈자리가 있습니다.",
    clusterId: "dating",
    emptyAreaId: null,
    star: { x: 0.79, y: 0.22 },
    products: clusters[1].products,
    sameIdea: {
      count: 31,
      firstAt: "2026년 5월 19일",
      langs: [
        { label: "한국어", count: 14 },
        { label: "영어", count: 13 },
        { label: "스페인어", count: 4 },
      ],
    },
    trends: [
      { word: "AI 데이팅", change: 0.09, series: [30, 31, 30, 32, 31, 33, 32, 33, 32, 34, 33, 34] },
      { word: "궁합 분석", change: -0.12, series: [18, 17, 18, 16, 17, 16, 15, 16, 15, 15, 14, 15] },
    ],
  },
  {
    id: "3",
    oneLiner: "김치 숙성도를 알려 주는 센서",
    verdict: "rare",
    summary:
      "가까운 제품이 거의 없습니다. 화두는 꾸준히 오르는데 출시된 것이 적은 빈 영역입니다.",
    clusterId: null,
    emptyAreaId: "kimchi",
    star: { x: 0.5, y: 0.87 },
    products: [
      product("예시 제품 파", "냉장고 안 온도와 습도를 기록하는 센서", "2023년 3월", "운영 중", 0.49),
      product("예시 제품 하", "와인 숙성 상태를 알려 주는 병마개", "2022년 8월", "중단", 0.44),
    ],
    sameIdea: {
      count: 9,
      firstAt: "2026년 10월 11일",
      langs: [
        { label: "한국어", count: 8 },
        { label: "영어", count: 1 },
      ],
    },
    trends: [
      { word: "김치냉장고", change: 0.31, series: [40, 38, 41, 43, 42, 46, 45, 49, 48, 51, 53, 55] },
      { word: "발효 식품", change: 0.22, series: [22, 23, 22, 24, 25, 24, 26, 27, 26, 28, 28, 29] },
    ],
  },
];

export const trendingClusters = clusters
  .filter((cluster) => cluster.state === "growing")
  .sort((a, b) => b.growthScore - a.growthScore)
  .slice(0, 5);

export function findCluster(id: string) {
  return clusters.find((cluster) => cluster.id === id);
}

export function findReport(id: string) {
  return reports.find((report) => report.id === id);
}

export function findEmptyArea(id: string) {
  return emptyAreas.find((area) => area.id === id);
}
