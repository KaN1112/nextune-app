import test from "node:test";
import assert from "node:assert/strict";
import { RingBuffer, gamingScore } from "../src/js/state.js";
test("paused monitoring leaves a gap rather than showing old data as current", () => {
  const ring = new RingBuffer(60);
  ring.pushTimed(10, 0);
  ring.pushTimed(20, 120000);
  assert.equal(ring.values.length, 60);
  assert.equal(ring.values[0], null);
  assert.equal(ring.values.at(-1), 20);
});
test("ring buffer retains exactly the latest 60 samples", () => {
  const r = new RingBuffer();
  for (let i = 0; i < 100; i++) r.push(i);
  assert.equal(r.values.length, 60);
  assert.equal(r.values[0], 40);
});
test("missing data does not masquerade as a readiness score", () => {
  const result = gamingScore({ cpu: 10 });
  assert.equal(result.score, null);
  assert.equal(result.coverage, 1);
  assert.equal(result.points[1].value, null);
});
test("score weights total 100 and excellent requires all evidence", () => {
  const result = gamingScore({
    cpu: 10,
    ramPercent: 40,
    diskFreePercent: 50,
    ping: { average: 12, packetLoss: 0 },
    gameMode: true,
    backgroundCount: 0,
  });
  assert.equal(result.score, 100);
  assert.equal(result.label, "非常に良好");
  assert.equal(
    result.points.reduce((n, p) => n + p.max, 0),
    100,
  );
});
test("measured zero remains a legitimate value", () => {
  const result = gamingScore({
    cpu: 0,
    ramPercent: 0,
    diskFreePercent: 0,
    ping: { average: 0, packetLoss: 0 },
    gameMode: false,
    backgroundCount: 0,
  });
  assert.equal(result.score, 70);
  assert.equal(result.label, "標準");
});
test("packet loss reduces network readiness", () => {
  const result = gamingScore({
    cpu: 90,
    ramPercent: 95,
    diskFreePercent: 1,
    ping: { average: 10, packetLoss: 50 },
    gameMode: false,
    backgroundCount: 4,
  });
  assert.equal(result.score, 3);
  assert.equal(result.label, "確認が必要");
});
