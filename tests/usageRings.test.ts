import assert from "node:assert/strict";
import test from "node:test";

import { calculateUsageRingPercentages } from "../src/utils/usageRings";

test("capped usage rings use the package limit for every ring", () => {
  const result = calculateUsageRingPercentages(107.5, 17.7, 125.2, 200, false);

  assert.equal(result.mode, "limit");
  assert.equal(result.total, 62.6);
  assert.equal(result.download, 53.75);
  assert.equal(result.upload, 8.85);
});

test("uncapped usage rings show download and upload share of traffic", () => {
  const result = calculateUsageRingPercentages(85.1, 3.5, 88.6, null, true);

  assert.equal(result.mode, "traffic-share");
  assert.equal(result.total, null);
  assert.ok(Math.abs(result.download + result.upload - 100) < 0.000001);
});

test("usage rings handle missing, negative and zero values safely", () => {
  assert.deepEqual(
    calculateUsageRingPercentages(Number.NaN, -2, 0, null, true),
    { total: null, download: 0, upload: 0, mode: "traffic-share" },
  );
});
