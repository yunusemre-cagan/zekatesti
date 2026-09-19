import { describe, expect, it } from "vitest";
import { IQ_SCALE } from "@/lib/config";
import { estimateIq, iqToPercentile } from "./iq";

describe("estimateIq", () => {
  it("beklenen ortalama başarıda ortalama IQ'yu verir", () => {
    expect(estimateIq(IQ_SCALE.EXPECTED_SCORE_MEAN)).toBe(IQ_SCALE.MEAN);
  });

  it("bir standart sapma yukarıda 115 verir", () => {
    expect(estimateIq(IQ_SCALE.EXPECTED_SCORE_MEAN + IQ_SCALE.EXPECTED_SCORE_SD)).toBe(115);
  });

  it("başarı arttıkça IQ azalmaz (monoton artan)", () => {
    let previous = -Infinity;
    for (let ratio = 0; ratio <= 1; ratio += 0.05) {
      const iq = estimateIq(ratio);
      expect(iq).toBeGreaterThanOrEqual(previous);
      previous = iq;
    }
  });

  it("sonucu [MIN, MAX] aralığına sınırlar", () => {
    expect(estimateIq(0)).toBe(IQ_SCALE.MIN);
    expect(estimateIq(1)).toBeLessThanOrEqual(IQ_SCALE.MAX);
    expect(estimateIq(-5)).toBe(IQ_SCALE.MIN);
    expect(estimateIq(5)).toBeLessThanOrEqual(IQ_SCALE.MAX);
  });

  it("tam sayı döner", () => {
    expect(Number.isInteger(estimateIq(0.63))).toBe(true);
  });
});

describe("iqToPercentile", () => {
  it.each([
    [100, 50],
    [115, 84],
    [130, 98],
    [85, 16],
  ])("IQ %i → yüzdelik %i", (iq, expected) => {
    expect(iqToPercentile(iq)).toBe(expected);
  });

  it("sonucu 1–99 aralığına sınırlar", () => {
    expect(iqToPercentile(200)).toBe(99);
    expect(iqToPercentile(0)).toBe(1);
  });
});
