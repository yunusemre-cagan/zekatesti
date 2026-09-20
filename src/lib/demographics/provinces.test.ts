import { describe, expect, it } from "vitest";
import { getProvinceName, isValidProvinceCode, PROVINCES } from "./provinces";

describe("PROVINCES", () => {
  it("81 il içerir", () => {
    expect(PROVINCES).toHaveLength(81);
  });

  it("plaka kodları 1'den 81'e kadar eksiksiz ve tekrarsızdır", () => {
    const codes = PROVINCES.map((province) => province.code).sort((a, b) => a - b);
    expect(codes).toEqual(Array.from({ length: 81 }, (_, index) => index + 1));
  });

  it("il adları tekrar etmez", () => {
    const names = PROVINCES.map((province) => province.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("bilinen plaka kodlarını doğru eşler", () => {
    expect(getProvinceName(1)).toBe("Adana");
    expect(getProvinceName(34)).toBe("İstanbul");
    expect(getProvinceName(35)).toBe("İzmir");
    expect(getProvinceName(81)).toBe("Düzce");
  });
});

describe("isValidProvinceCode", () => {
  it("geçerli kodları kabul eder", () => {
    expect(isValidProvinceCode(1)).toBe(true);
    expect(isValidProvinceCode(81)).toBe(true);
  });

  it("aralık dışındaki kodları reddeder", () => {
    for (const code of [0, 82, -1, 999]) {
      expect(isValidProvinceCode(code)).toBe(false);
    }
  });
});
