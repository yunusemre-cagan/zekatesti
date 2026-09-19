import { describe, expect, it } from "vitest";
import { formatDuration, getElapsedSec, getRemainingSec } from "./time";

describe("getRemainingSec", () => {
  it("geçen süreyi düşerek kalan süreyi verir", () => {
    expect(getRemainingSec(0, 60, 10_000)).toBe(50);
  });

  it("süre dolduğunda negatif değil sıfır döner", () => {
    expect(getRemainingSec(0, 60, 120_000)).toBe(0);
  });

  it("sayaç yeni başlamışken tam süreyi gösterir", () => {
    expect(getRemainingSec(1_000, 30, 1_000)).toBe(30);
  });
});

describe("getElapsedSec", () => {
  it("geçen süreyi saniyeye yuvarlar", () => {
    expect(getElapsedSec(0, 12_400)).toBe(12);
    expect(getElapsedSec(0, 12_600)).toBe(13);
  });

  it("saat ileri alınmış gibi durumlarda negatif değer döndürmez", () => {
    expect(getElapsedSec(10_000, 5_000)).toBe(0);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [65, "1:05"],
    [600, "10:00"],
    [1800, "30:00"],
    [3661, "1:01:01"],
  ])("%i saniye → %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it("negatif değeri sıfır gibi gösterir", () => {
    expect(formatDuration(-5)).toBe("0:00");
  });
});
