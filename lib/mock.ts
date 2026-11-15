// Dummy data for laying out the screens before the real API exists (M3, M4).
// Everything here is invented for display. The shapes follow what the pages
// will later receive from the database.
//
// The universe has three levels so it can hold ideas from every field:
//   domain (a galaxy, e.g. 헬스케어·바이오)
//     → area (a cluster of similar ideas, e.g. 수면 관리)
//       → idea (one product, patent or question)

export type ClusterState = "steady" | "growing" | "saturated" | "fading";
export type Verdict = "exists" | "similar" | "rare";
export type IconName =
  | "spark" | "cross" | "leaf" | "car" | "cap" | "bars" | "bag" | "play" | "sprout";

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
  domainId: string;
  label: string;
  state: ClusterState;
  itemCount: number;
  queryCount: number;
  weeklyNewItems: number;
  growthScore: number;
  weeklyLaunches: number[];
  weeklyQueries: number[];
  products: Product[];
};

export type Domain = {
  id: string;
  label: string;
  icon: IconName;
  // "r,g,b" so the canvas and the cards can both apply their own opacity.
  color: string;
  growthPercent: number;
  ideaCount: number;
  // Relative size of the galaxy on the map.
  size: number;
  // Position on the home map as fractions of the map area, for portrait
  // (tall) and landscape (wide) screens.
  tall: [number, number];
  wide: [number, number];
};

export type EmptyArea = {
  id: string;
  domainId: string;
  label: string;
  trendScore: number;
  itemCount: number;
  queryCount: number;
  words: string[];
};

export type Report = {
  id: string;
  oneLiner: string;
  verdict: Verdict;
  summary: string;
  clusterId: string | null;
  emptyAreaId: string | null;
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
  growing: "뜨는 중",
  saturated: "포화",
  fading: "식는 중",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  exists: "이미 있음",
  similar: "비슷한 것 있음",
  rare: "거의 없음",
};

export const domains: Domain[] = [
  { id: "ai", label: "AI·생성형 AI", icon: "spark", color: "255,176,96", growthPercent: 89, ideaCount: 12400, size: 1.5, tall: [0.5, 0.46], wide: [0.5, 0.5] },
  { id: "health", label: "헬스케어·바이오", icon: "cross", color: "200,130,255", growthPercent: 28, ideaCount: 2900, size: 1, tall: [0.27, 0.04], wide: [0.5, 0.03] },
  { id: "climate", label: "기후·에너지", icon: "leaf", color: "110,230,170", growthPercent: 32, ideaCount: 3100, size: 1, tall: [0.74, 0.06], wide: [0.2, 0.14] },
  { id: "mobility", label: "로봇·모빌리티", icon: "car", color: "110,170,255", growthPercent: 41, ideaCount: 4200, size: 1.1, tall: [0.25, 0.25], wide: [0.8, 0.14] },
  { id: "edu", label: "교육·학습", icon: "cap", color: "255,130,210", growthPercent: 20, ideaCount: 1800, size: 0.9, tall: [0.76, 0.27], wide: [0.1, 0.52] },
  { id: "finance", label: "금융·경제", icon: "bars", color: "255,206,96", growthPercent: 24, ideaCount: 2100, size: 1, tall: [0.24, 0.68], wide: [0.2, 0.9] },
  { id: "life", label: "소비·생활", icon: "bag", color: "190,150,255", growthPercent: 13, ideaCount: 1100, size: 0.85, tall: [0.76, 0.66], wide: [0.9, 0.52] },
  { id: "play", label: "콘텐츠·게임", icon: "play", color: "120,220,255", growthPercent: 19, ideaCount: 1300, size: 0.9, tall: [0.27, 0.9], wide: [0.5, 0.97] },
  { id: "food", label: "식품·농업", icon: "sprout", color: "170,230,110", growthPercent: 17, ideaCount: 1600, size: 0.9, tall: [0.74, 0.88], wide: [0.8, 0.9] },
];

function product(
  name: string,
  oneLiner: string,
  launched: string | null,
  status: string,
  similarity: number,
): Product {
  return { name, oneLiner, launched, status, url: "https://example.com", similarity };
}

// Areas written out by hand, with their own products and numbers.
const written: Cluster[] = [
  {
    id: "agent", domainId: "ai", label: "AI 에이전트 비서", state: "saturated",
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
    id: "local-llm", domainId: "ai", label: "로컬 LLM 도구", state: "growing",
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
    id: "meeting", domainId: "ai", label: "음성 회의록", state: "growing",
    itemCount: 124, queryCount: 28, weeklyNewItems: 12, growthScore: 1.5,
    weeklyLaunches: [6, 7, 6, 8, 7, 9, 8, 10, 9, 11, 10, 12],
    weeklyQueries: [1, 2, 1, 2, 3, 2, 3, 3, 4, 3, 4, 5],
    products: [
      product("예시 제품 카", "회의를 녹음해 요약과 할 일을 뽑아 주는 앱", "2023년 10월", "운영 중", 0.82),
      product("예시 제품 타", "통화 내용을 받아 적는 도구", "2025년 1월", "운영 중", 0.7),
    ],
  },
  {
    id: "idea", domainId: "ai", label: "아이디어 검색", state: "growing",
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
    id: "dating", domainId: "life", label: "AI 소개팅", state: "saturated",
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
    id: "audio", domainId: "play", label: "오디오 게임", state: "growing",
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
    id: "pet-health", domainId: "health", label: "반려동물 건강 기록", state: "growing",
    itemCount: 66, queryCount: 19, weeklyNewItems: 7, growthScore: 1.3,
    weeklyLaunches: [4, 5, 4, 5, 6, 5, 6, 5, 6, 6, 7, 7],
    weeklyQueries: [1, 1, 2, 1, 2, 2, 3, 2, 3, 3, 3, 4],
    products: [
      product("예시 제품 거", "산책과 식사, 병원 기록을 한곳에 모으는 앱", "2024년 5월", "운영 중", 0.75),
      product("예시 제품 너", "사진으로 피부 상태를 살펴 주는 도구", "2025년 9월", "운영 중", 0.68),
    ],
  },
];

// The remaining areas only need to fill the map, so their numbers are
// derived from the name.
const SHAPES: Record<ClusterState, number[]> = {
  growing: [0.35, 0.4, 0.42, 0.5, 0.55, 0.6, 0.62, 0.72, 0.78, 0.85, 0.92, 1],
  saturated: [0.9, 0.95, 0.88, 1, 0.92, 0.97, 0.9, 0.94, 0.99, 0.9, 0.93, 0.95],
  steady: [0.7, 0.66, 0.74, 0.7, 0.68, 0.75, 0.7, 0.72, 0.69, 0.74, 0.7, 0.72],
  fading: [1, 0.95, 0.9, 0.82, 0.8, 0.7, 0.66, 0.58, 0.5, 0.46, 0.4, 0.36],
};

function sketch(domainId: string, index: number, label: string, state: ClusterState): Cluster {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  const peak = 6 + (hash % 22);
  const weeklyLaunches = SHAPES[state].map((share) => Math.round(share * peak));
  const weeklyQueries = SHAPES[state].map((share) => Math.round(share * (2 + (hash % 9))));
  const recent = weeklyLaunches.slice(7, 11);
  const average = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  return {
    id: `${domainId}-${index}`,
    domainId,
    label,
    state,
    itemCount: 40 + (hash % 380),
    queryCount: 6 + (hash % 58),
    weeklyNewItems: weeklyLaunches[11],
    growthScore: Math.round((weeklyLaunches[11] / average) * 10) / 10,
    weeklyLaunches,
    weeklyQueries,
    products: [1, 2, 3].map((n) =>
      product(`${label} 예시 제품 ${n}`, `${label} 영역의 자리 표시용 제품입니다`, n === 3 ? null : `202${3 + n}년 ${n * 3}월`, n === 3 ? "중단" : "운영 중", 0.8 - n * 0.07),
    ),
  };
}

const SKETCHED: Record<string, [string, ClusterState][]> = {
  ai: [["이미지·영상 생성", "saturated"], ["코딩 도우미", "saturated"]],
  health: [["수면 관리", "growing"], ["마음 건강 상담", "steady"], ["복약 알림", "steady"], ["원격 진료", "saturated"], ["어르신 돌봄", "growing"]],
  climate: [["가정용 태양광", "growing"], ["탄소 발자국 기록", "fading"], ["전기차 충전", "growing"], ["분리배출 도우미", "steady"], ["에너지 절약 가전", "steady"], ["중고 거래", "saturated"]],
  mobility: [["배달 로봇", "growing"], ["자율주행 보조", "saturated"], ["드론 촬영", "steady"], ["주차 공유", "fading"], ["자전거 길 안내", "steady"], ["로봇 청소", "saturated"]],
  edu: [["언어 학습", "saturated"], ["코딩 교육", "steady"], ["입시 관리", "steady"], ["독서 기록", "fading"], ["어린이 놀이 학습", "growing"], ["직무 전환", "growing"]],
  finance: [["가계부", "saturated"], ["소액 투자", "steady"], ["구독 관리", "growing"], ["환전·송금", "steady"], ["세금 신고", "growing"], ["신용 관리", "fading"]],
  life: [["식단 기록", "steady"], ["동네 모임", "growing"], ["옷장 관리", "fading"], ["여행 일정", "saturated"], ["집 정리", "steady"]],
  play: [["방 탈출 게임", "steady"], ["웹소설 도구", "growing"], ["짧은 영상 편집", "saturated"], ["보드게임 도우미", "steady"], ["버추얼 캐릭터", "growing"]],
  food: [["밀키트", "saturated"], ["스마트 텃밭", "growing"], ["식당 예약", "saturated"], ["발효 음식", "steady"], ["유통기한 관리", "steady"], ["농산물 직거래", "growing"]],
};

export const clusters: Cluster[] = [
  ...written,
  ...Object.entries(SKETCHED).flatMap(([domainId, areas]) =>
    areas.map(([label, state], index) => sketch(domainId, index + 1, label, state)),
  ),
];

export const emptyAreas: EmptyArea[] = [
  { id: "kimchi", domainId: "food", label: "김치 숙성 센서", trendScore: 78, itemCount: 2, queryCount: 9, words: ["김치냉장고", "발효", "숙성도"] },
  { id: "plant", domainId: "life", label: "반려식물 진단", trendScore: 71, itemCount: 4, queryCount: 12, words: ["식집사", "과습", "잎 마름"] },
  { id: "elder-call", domainId: "health", label: "어르신 말벗 전화", trendScore: 66, itemCount: 3, queryCount: 7, words: ["독거", "안부 전화", "돌봄"] },
  { id: "tool-share", domainId: "life", label: "동네 공구 대여", trendScore: 59, itemCount: 5, queryCount: 6, words: ["전동 드릴", "셀프 인테리어"] },
  { id: "sleep-sound", domainId: "health", label: "수면 소리 분석", trendScore: 54, itemCount: 6, queryCount: 5, words: ["코골이", "수면 무호흡"] },
];

export function findCluster(id: string) {
  return clusters.find((cluster) => cluster.id === id);
}

export function findDomain(id: string) {
  return domains.find((domain) => domain.id === id);
}

export function findEmptyArea(id: string) {
  return emptyAreas.find((area) => area.id === id);
}

export function areasOf(domainId: string) {
  return clusters.filter((cluster) => cluster.domainId === domainId);
}

export function emptyAreasOf(domainId: string) {
  return emptyAreas.filter((area) => area.domainId === domainId);
}

export const reports: Report[] = [
  {
    id: "1",
    oneLiner: "소리만으로 하는 잠수함 게임",
    verdict: "similar",
    summary:
      "재미는 여러 번 확인됐고, 완성도 있게 다듬은 모바일 제품은 검색에서 보이지 않았습니다.",
    clusterId: "audio",
    emptyAreaId: null,
    products: findCluster("audio")!.products,
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
    products: findCluster("dating")!.products,
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

export function findReport(id: string) {
  return reports.find((report) => report.id === id);
}

export const trendingClusters = clusters
  .filter((cluster) => cluster.state === "growing")
  .sort((a, b) => b.growthScore - a.growthScore)
  .slice(0, 5);

export const totals = {
  ideas: domains.reduce((sum, domain) => sum + domain.ideaCount, 0),
  domains: domains.length,
  areas: clusters.length,
  languages: 14,
};

// 12400 → "1.2만", 2900 → "2,900"
export function formatCount(value: number) {
  return value >= 10000
    ? `${(value / 10000).toFixed(1).replace(/\.0$/, "")}만`
    : value.toLocaleString("ko-KR");
}
