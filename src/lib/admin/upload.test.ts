import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, resolveUploadTarget } from "./upload";

const PUBLIC_DIR = "/proje/public";

function resolve(
  questionId: string,
  fileName: string,
  mimeType = "image/svg+xml",
  size = 1000,
) {
  return resolveUploadTarget(questionId, fileName, mimeType, size, PUBLIC_DIR);
}

describe("resolveUploadTarget", () => {
  it("dosyayı sorunun klasörüne yerleştirir", () => {
    const target = resolve("matris-01", "cevap.svg");
    expect(target.ok).toBe(true);
    if (!target.ok) return;
    expect(target.publicPath).toMatch(/^\/questions\/matris-01\/cevap-[a-z0-9]{4}\.svg$/);
    expect(target.absolutePath.startsWith(path.join(PUBLIC_DIR, "questions", "matris-01"))).toBe(true);
  });

  it("dosya adındaki klasör çıkma denemelerini etkisizleştirir", () => {
    const target = resolve("matris-01", "../../../etc/passwd.svg");
    expect(target.ok).toBe(true);
    if (!target.ok) return;
    expect(target.publicPath).not.toContain("..");
    expect(target.absolutePath.startsWith(path.join(PUBLIC_DIR, "questions", "matris-01"))).toBe(true);
  });

  it("Türkçe karakterleri ve boşlukları güvenli ada çevirir", () => {
    const target = resolve("soru-01", "Şekil Öğesi.png", "image/png");
    expect(target.ok).toBe(true);
    if (!target.ok) return;
    expect(target.publicPath).toMatch(/^\/questions\/soru-01\/sekil-ogesi-[a-z0-9]{4}\.png$/);
  });

  it("uzantıyı dosya adından değil, dosya tipinden belirler", () => {
    const target = resolve("soru-01", "zararli.html", "image/png");
    expect(target.ok).toBe(true);
    if (!target.ok) return;
    expect(target.publicPath.endsWith(".png")).toBe(true);
  });

  it("geçersiz soru kimliğini reddeder", () => {
    for (const id of ["", "Büyük-Harf", "../gizli", "bosluk var"]) {
      expect(resolve(id, "a.svg").ok).toBe(false);
    }
  });

  it("desteklenmeyen dosya tipini reddeder", () => {
    expect(resolve("soru-01", "a.pdf", "application/pdf").ok).toBe(false);
    expect(resolve("soru-01", "a.html", "text/html").ok).toBe(false);
  });

  it("boş ve çok büyük dosyaları reddeder", () => {
    expect(resolve("soru-01", "a.svg", "image/svg+xml", 0).ok).toBe(false);
    expect(resolve("soru-01", "a.svg", "image/svg+xml", MAX_UPLOAD_BYTES + 1).ok).toBe(false);
  });
});
