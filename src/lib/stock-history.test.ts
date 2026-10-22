import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stockHistoryPoints, stockHistoryRange } from "./stock-history";

const now = new Date(2026, 9, 22);
const session = (id: string, date: string, status = "closed", restaurant_id = "r1") => ({ id, reference_date: date, status, restaurant_id });
const wines = [{ id: "w1", volume: "750ml" }, { id: "w2", volume: "Taça 150ml" }, { id: "w3", volume: "750ml" }];

describe("stock count history", () => {
  it("includes only counts in the last six calendar months, through today", () => {
    assert.deepEqual(stockHistoryRange(now), { start: "2026-05-01", end: "2026-10-22" });
    assert.deepEqual(stockHistoryPoints([session("old", "2026-04-30"), session("first", "2026-05-01"), session("today", "2026-10-22"), session("future", "2026-10-23")], [], wines, ["r1"], now).map((p) => p.id), ["first", "today"]);
  });
  it("sums bottle quantities per count, excluding glasses and uncounted quantities", () => {
    const points = stockHistoryPoints([session("a", "2026-06-10")], [
      { session_id: "a", wine_id: "w1", counted_qty: 12 },
      { session_id: "a", wine_id: "w3", counted_qty: 8 },
      { session_id: "a", wine_id: "w2", counted_qty: 40 },
      { session_id: "a", wine_id: "w1", counted_qty: null },
    ], wines, ["r1"], now);
    assert.equal(points[0]?.bottles, 20);
  });
  it("keeps each count separate, in chronological order, including zero stock", () => {
    assert.deepEqual(stockHistoryPoints([session("b", "2026-06-20"), session("a", "2026-06-10")], [{ session_id: "b", wine_id: "w1", counted_qty: 9 }], wines, ["r1"], now).map((p) => [p.date, p.bottles]), [["2026-06-10", 0], ["2026-06-20", 9]]);
  });
  it("uses only closed counts belonging to the selected restaurants", () => {
    assert.deepEqual(stockHistoryPoints([session("a", "2026-06-10"), session("draft", "2026-06-11", "draft"), session("other", "2026-06-12", "closed", "r2")], [], wines, ["r1"], now).map((p) => p.id), ["a"]);
  });
});