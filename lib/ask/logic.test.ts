import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowRequest,
  arrivalGroup,
  buildReport,
  extractJson,
  parseRefine,
  parseReport,
  placeStar,
  sanitize,
  verdictFor,
  type Match,
} from "./logic.ts";

const THRESHOLDS = { exists: 0.6, similar: 0.47 };

function match(id: number, similarity: number, extra: Partial<Match> = {}): Match {
  return {
    id,
    source: "github",
    name: `owner/repo${id}`,
    oneLiner: `Description ${id}`,
    url: `https://example.com/${id}`,
    year: 2024,
    status: "active",
    similarity,
    gx: 1000 * id,
    gy: 2000 * id,
    group: "search · tools",
    ...extra,
  };
}

test("sanitize removes contact details and links", () => {
  assert.equal(
    sanitize("  소리로 하는 게임\n문의는 kim@example.com 또는 010-1234-5678, https://me.example/x 참고 "),
    "소리로 하는 게임 문의는 또는 , 참고",
  );
  assert.equal(sanitize("x".repeat(500)).length, 120);
  assert.equal(sanitize("버전 2 는 2024년 출시"), "버전 2 는 2024년 출시");
});

test("verdict follows the thresholds", () => {
  assert.equal(verdictFor(0.74, THRESHOLDS), "exists");
  assert.equal(verdictFor(0.6, THRESHOLDS), "exists");
  assert.equal(verdictFor(0.5, THRESHOLDS), "similar");
  assert.equal(verdictFor(0.46, THRESHOLDS), "rare");
  assert.equal(verdictFor(0, THRESHOLDS), "rare");
});

test("extractJson finds JSON inside prose and fences", () => {
  assert.deepEqual(extractJson('Here you go:\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.equal(extractJson("no json here"), null);
  assert.equal(extractJson("{broken"), null);
});

test("parseRefine uses the model's sentence and cleans it", () => {
  const raw = '{"one_liner": "소리만으로 하는 잠수함 게임 (연락: a@b.co)", "lang": "ko"}';
  assert.deepEqual(parseRefine(raw, "원문"), { oneLiner: "소리만으로 하는 잠수함 게임 (연락: )", lang: "ko" });
});

test("parseRefine falls back to the cleaned input", () => {
  assert.deepEqual(parseRefine(null, " 내 아이디어  test@x.io "), { oneLiner: "내 아이디어", lang: null });
  assert.deepEqual(parseRefine("garbage", "idea"), { oneLiner: "idea", lang: null });
  assert.deepEqual(parseRefine('{"one_liner": "", "lang": "korean"}', "idea"), { oneLiner: "idea", lang: null });
});

test("parseReport drops products that were not in the search results", () => {
  const matches = [match(1, 0.7), match(2, 0.6)];
  const raw = JSON.stringify({
    summary: "가까운 것이 있습니다.",
    picks: [
      { id: 2, note: "같은 문제" },
      { id: 999, note: "지어낸 제품" },
      { id: 2, note: "중복" },
      { id: "1", note: "문자열 id" },
    ],
  });
  assert.deepEqual(parseReport(raw, matches), {
    summary: "가까운 것이 있습니다.",
    picks: [
      { id: 2, note: "같은 문제" },
      { id: 1, note: "문자열 id" },
    ],
  });
});

test("parseReport rejects an answer without a summary", () => {
  assert.equal(parseReport('{"picks": []}', [match(1, 0.7)]), null);
  assert.equal(parseReport(null, [match(1, 0.7)]), null);
  assert.equal(parseReport("not json", [match(1, 0.7)]), null);
});

test("buildReport puts the model's picks first and fills up with the closest", () => {
  const matches = [1, 2, 3, 4, 5, 6, 7].map((id) => match(id, 0.8 - id * 0.05));
  const report = buildReport({
    oneLiner: "아이디어",
    verdict: "exists",
    matches,
    written: { summary: "요약", picks: [{ id: 3, note: "핵심" }] },
    same: { count: 0, firstAt: null, langs: [] },
    similarThreshold: 0.47,
  });
  assert.equal(report.written, true);
  assert.deepEqual(report.products.map((p) => p.id), [3, 1, 2, 4, 5]);
  assert.equal(report.products[0].note, "핵심");
  assert.equal("gx" in report.products[0], false);
  assert.equal(report.topSimilarity, matches[0].similarity);
});

test("buildReport without a model answer says so and uses plain text", () => {
  const report = buildReport({
    oneLiner: "아이디어",
    verdict: "rare",
    matches: [match(1, 0.3)],
    written: null,
    same: { count: 0, firstAt: null, langs: [] },
    similarThreshold: 0.47,
  });
  assert.equal(report.written, false);
  assert.match(report.summary, /거의 없습니다/);
  assert.equal(report.arrival, null);
});

test("placeStar leans toward the most similar item", () => {
  const star = placeStar([match(1, 0.9, { gx: 0, gy: 0 }), match(2, 0.5, { gx: 1000, gy: 1000 })]);
  assert.ok(star && star.x < 100 && star.y < 100);
  assert.equal(placeStar([match(1, 0.9, { gx: null, gy: null })]), null);
  assert.equal(placeStar([]), null);
});

test("arrivalGroup takes the majority among close matches only", () => {
  const matches = [
    match(1, 0.7, { group: "a" }),
    match(2, 0.6, { group: "b" }),
    match(3, 0.55, { group: "b" }),
    match(4, 0.3, { group: "c" }),
    match(5, 0.3, { group: "c" }),
  ];
  assert.equal(arrivalGroup(matches, 0.47), "b");
  assert.equal(arrivalGroup(matches, 0.9), null);
});

test("allowRequest limits per client inside the window", () => {
  const log = new Map<string, number[]>();
  assert.equal(allowRequest(log, "a", 0, 2, 1000), true);
  assert.equal(allowRequest(log, "a", 100, 2, 1000), true);
  assert.equal(allowRequest(log, "a", 200, 2, 1000), false);
  assert.equal(allowRequest(log, "b", 200, 2, 1000), true);
  assert.equal(allowRequest(log, "a", 1101, 2, 1000), true);
});
