import { describe, expect, it } from "vitest";
import { QUESTION_TIME } from "@/lib/config";
import { makeSingleChoice, makeSpeedTask } from "@/lib/testing/fixtures";
import { capRecordedSec, getExpectedSec, getSpeedFactor } from "./speed-factor";

describe("getExpectedSec", () => {
  it("zorluğa göre varsayılan süreyi verir", () => {
    expect(getExpectedSec(makeSingleChoice({ difficulty: 1 }))).toBe(15);
    expect(getExpectedSec(makeSingleChoice({ difficulty: 2 }))).toBe(25);
    expect(getExpectedSec(makeSingleChoice({ difficulty: 3 }))).toBe(40);
  });

  it("soruya özel süre girilmişse onu kullanır", () => {
    expect(getExpectedSec(makeSingleChoice({ difficulty: 1, expectedSec: 20 }))).toBe(20);
  });
});

describe("capRecordedSec", () => {
  it("üst sınırın üstündeki süreyi kırpar", () => {
    expect(capRecordedSec(99_999)).toBe(QUESTION_TIME.MAX_RECORDED_SEC);
  });

  it("geçersiz veya negatif değerleri sıfırlar", () => {
    expect(capRecordedSec(-5)).toBe(0);
    expect(capRecordedSec(Number.NaN)).toBe(0);
    expect(capRecordedSec(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("getSpeedFactor", () => {
  // Zorluk 1 → beklenen süre 15 saniye.
  const question = makeSingleChoice({ difficulty: 1 });

  it("beklenen sürede veya daha hızlı çözümde tam çarpan verir", () => {
    expect(getSpeedFactor(question, 15)).toBe(1);
    expect(getSpeedFactor(question, 8)).toBe(1);
  });

  it("beklenenin iki katı sürede yarım çarpan verir", () => {
    expect(getSpeedFactor(question, 30)).toBeCloseTo(0.5);
  });

  it("eşiğin hemen üstünde kademeli düşer", () => {
    expect(getSpeedFactor(question, 20)).toBeCloseTo(0.75);
    expect(getSpeedFactor(question, 25)).toBeCloseTo(0.6);
  });

  it("çarpanı alt sınırın altına düşürmez", () => {
    expect(getSpeedFactor(question, 10_000)).toBe(QUESTION_TIME.SPEED_FACTOR_MIN);
  });

  it("süre uzadıkça çarpan azalır (monoton)", () => {
    let previous = 1.1;
    for (const seconds of [10, 20, 30, 45, 90]) {
      const factor = getSpeedFactor(question, seconds);
      expect(factor).toBeLessThanOrEqual(previous);
      previous = factor;
    }
  });

  it("hız görevlerinde çarpan uygulanmaz (çifte ceza olmaz)", () => {
    expect(getSpeedFactor(makeSpeedTask(), 10_000)).toBe(1);
  });

  it("süre ölçülmemişse veya çok kısaysa çarpan 1'dir", () => {
    expect(getSpeedFactor(question, undefined)).toBe(1);
    expect(getSpeedFactor(question, 0)).toBe(1);
  });

  it("soruya özel beklenen süreyi dikkate alır", () => {
    const quick = makeSingleChoice({ difficulty: 1, expectedSec: 10 });
    expect(getSpeedFactor(quick, 20)).toBeCloseTo(0.5);
  });
});
