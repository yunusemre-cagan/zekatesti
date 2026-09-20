import { describe, expect, it } from "vitest";
import { shuffleWithSeed } from "./shuffle";

const items = ["a", "b", "c", "d", "e"];

describe("shuffleWithSeed", () => {
  it("aynı tohumda her zaman aynı sırayı verir", () => {
    expect(shuffleWithSeed(items, 3)).toEqual(shuffleWithSeed(items, 3));
  });

  it("farklı tohumlarda farklı sıralar üretir", () => {
    const orders = new Set(
      Array.from({ length: 10 }, (_, seed) => shuffleWithSeed(items, seed).join("")),
    );
    // On tohumdan en az yarısı farklı dizilim vermeli; aksi halde karıştırma işe yaramaz.
    expect(orders.size).toBeGreaterThanOrEqual(5);
  });

  it("öğeleri kaybetmez veya çoğaltmaz", () => {
    expect(shuffleWithSeed(items, 7).toSorted()).toEqual(items.toSorted());
  });

  it("girdi dizisini değiştirmez", () => {
    const original = [...items];
    shuffleWithSeed(items, 2);
    expect(items).toEqual(original);
  });

  it("boş ve tek öğeli dizilerde hata vermez", () => {
    expect(shuffleWithSeed([], 1)).toEqual([]);
    expect(shuffleWithSeed(["tek"], 1)).toEqual(["tek"]);
  });
});
