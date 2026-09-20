/**
 * Soru görsellerini (SVG) üretir.
 *
 * Görsel gerektiren sorular (görsel matris, uzamsal düşünme, kağıt katlama, şekil eşleştirme)
 * elle çizilmek yerine buradaki kurallardan üretilir. Böylece:
 *  - Soru ile görsel arasındaki kural kodda açıkça yazılıdır ve incelenebilir,
 *  - Bir kural değişirse tüm görseller tek komutla yeniden üretilir,
 *  - Şıklar arasındaki farklar (döndürme, ayna, eksik öğe) rastgele değil, bilinçlidir.
 *
 * Çalıştırma:  node scripts/generate-question-images.mjs
 * Çıktı:       public/questions/<soru-kimliği>/<dosya>.svg
 *
 * Kullanım: Yalnızca geliştirme sırasında elle çalıştırılır; uygulama çalışma anında
 * bu script'i kullanmaz, yalnızca ürettiği dosyaları servis eder.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_QUESTIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "questions",
);

// ---------------------------------------------------------------------------
// SVG temelleri
// ---------------------------------------------------------------------------

/**
 * SVG belgesini sarar.
 * Renkler, koyu temada da okunabilmesi için belge içindeki `<style>` bloğunda tanımlanır;
 * `prefers-color-scheme` kuralı `<img>` ile gömülen SVG'lerde de çalışır.
 */
function svgDocument(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<style>
  .line { stroke: #1a1a1a; fill: none; stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }
  .solid { fill: #1a1a1a; stroke: none; }
  .frame { stroke: #b0b0b0; fill: none; stroke-width: 2; }
  .dashed { stroke: #b0b0b0; fill: none; stroke-width: 2; stroke-dasharray: 6 6; }
  .label { fill: #1a1a1a; font-family: system-ui, sans-serif; font-size: 34px; text-anchor: middle; }
  /* Küp yüzleri: dolgu, arkadaki küplerin kenarlarını gizler (derinlik algısı için üç ton). */
  .face { stroke: #1a1a1a; stroke-width: 2.5; stroke-linejoin: round; }
  .face-top { fill: #ffffff; }
  .face-left { fill: #d8d8d8; }
  .face-right { fill: #efefef; }
  @media (prefers-color-scheme: dark) {
    .line { stroke: #ededed; }
    .solid { fill: #ededed; }
    .frame, .dashed { stroke: #666; }
    .label { fill: #ededed; }
    .face { stroke: #ededed; }
    .face-top { fill: #3a3a3a; }
    .face-left { fill: #141414; }
    .face-right { fill: #262626; }
  }
</style>
${body}
</svg>
`;
}

/** Ortalanmış düzgün çokgen (n kenarlı). */
function polygon(cx, cy, radius, sides, rotationDeg = -90, className = "line") {
  const points = Array.from({ length: sides }, (_, index) => {
    const angle = ((rotationDeg + (360 / sides) * index) * Math.PI) / 180;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  });
  return `<polygon class="${className}" points="${points.join(" ")}" />`;
}

function circle(cx, cy, r, className = "line") {
  return `<circle class="${className}" cx="${cx}" cy="${cy}" r="${r}" />`;
}

function square(cx, cy, size, className = "line") {
  const half = size / 2;
  return `<rect class="${className}" x="${cx - half}" y="${cy - half}" width="${size}" height="${size}" />`;
}

function triangle(cx, cy, size, className = "line") {
  return polygon(cx, cy, size / 2, 3, -90, className);
}

/** Verilen dönüşümü (döndürme/ayna) uygulayan grup. */
function group(transform, body) {
  return `<g transform="${transform}">${body}</g>`;
}

// ---------------------------------------------------------------------------
// 1) Görsel matris soruları
// ---------------------------------------------------------------------------

const MATRIX_CELL = 110;
const MATRIX_GAP = 8;

/**
 * 3×3 matris çizer. `renderCell(row, col)` her hücrenin içeriğini üretir; `undefined`
 * dönerse hücreye soru işareti konur (aranan hücre).
 */
function matrixSvg(renderCell) {
  const step = MATRIX_CELL + MATRIX_GAP;
  const size = step * 3 - MATRIX_GAP;
  let body = "";

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const x = col * step;
      const y = row * step;
      body += `<rect class="frame" x="${x}" y="${y}" width="${MATRIX_CELL}" height="${MATRIX_CELL}" rx="6" />`;

      const content = renderCell(row, col);
      body +=
        content === undefined
          ? `<text class="label" x="${x + MATRIX_CELL / 2}" y="${y + MATRIX_CELL / 2 + 12}">?</text>`
          : group(`translate(${x} ${y})`, content);
    }
  }
  return svgDocument(size, size, body);
}

/** Tek bir şıkkın içeriğini, matris hücresiyle aynı boyutta bir kutuda gösterir. */
function cellOptionSvg(content) {
  const body = `<rect class="frame" x="0" y="0" width="${MATRIX_CELL}" height="${MATRIX_CELL}" rx="6" />${content}`;
  return svgDocument(MATRIX_CELL, MATRIX_CELL, body);
}

/** matris-01: satır şekli belirler (daire/kare/üçgen), sütun sayıyı belirler (1/2/3). */
function matrixShapeCount(row, col) {
  const count = col + 1;
  const drawShape = [
    (cx, cy) => circle(cx, cy, 13),
    (cx, cy) => square(cx, cy, 24),
    (cx, cy) => triangle(cx, cy, 28),
  ][row];

  // Şekiller hücre içinde yatay olarak eşit aralıklı dizilir.
  const positions = Array.from(
    { length: count },
    (_, index) => MATRIX_CELL / 2 + (index - (count - 1) / 2) * 32,
  );
  return positions.map((cx) => drawShape(cx, MATRIX_CELL / 2)).join("");
}

/** matris-02: sütun boyunca 45° döner, satır boyunca içindeki nokta sayısı artar. */
function matrixRotateDots(row, col) {
  const center = MATRIX_CELL / 2;
  const arrow = `<path class="line" d="M ${center} ${center + 30} L ${center} ${center - 30} M ${center - 12} ${center - 18} L ${center} ${center - 30} L ${center + 12} ${center - 18}" />`;
  const rotated = group(`rotate(${col * 45} ${center} ${center})`, arrow);

  const dots = Array.from({ length: row + 1 }, (_, index) =>
    circle(center + (index - row / 2) * 18, MATRIX_CELL - 16, 5, "solid"),
  ).join("");

  return rotated + dots;
}

/** matris-03: kenar sayısı satırda +1, sütunda +1 artar (üçgen → … → yedigen). */
function matrixPolygonSides(row, col) {
  const sides = 3 + row + col;
  return polygon(MATRIX_CELL / 2, MATRIX_CELL / 2, 38, sides);
}

/**
 * matris-04: Üçüncü sütun, ilk iki sütunun "simetrik farkı"dır.
 * Dört köşe konumundan yalnızca birinde işaret varsa üçüncü hücrede görünür,
 * ikisinde de varsa kaybolur.
 */
const MARK_POSITIONS = [
  [34, 34],
  [76, 34],
  [34, 76],
  [76, 76],
];

const MATRIX_04_ROWS = [
  [
    [0, 1],
    [1, 2],
  ],
  [
    [0, 3],
    [2, 3],
  ],
  [
    [1, 2],
    [2, 3],
  ],
];

function matrixSymmetricDifference(row, col) {
  const [first, second] = MATRIX_04_ROWS[row];
  const marks =
    col === 0
      ? first
      : col === 1
        ? second
        : first.filter((m) => !second.includes(m)).concat(second.filter((m) => !first.includes(m)));

  return marks
    .map((index) => {
      const [x, y] = MARK_POSITIONS[index];
      return circle(x, y, 11, "solid");
    })
    .join("");
}

/**
 * matris-05: Üç kural aynı anda işler ve hepsi birlikte kullanılmadan hücre bulunamaz.
 *  - Satır, şeklin kenar sayısını belirler (üçgen → kare → beşgen).
 *  - Sütun, şeklin dönüş açısını belirler (0° → 40° → 80°).
 *  - Hücre içindeki nokta sayısı (satır + sütun) mod 3 + 1 ile bulunur.
 */
function matrixThreeRules(row, col) {
  const sides = 3 + row;
  const rotation = -90 + col * 40;
  const dotCount = ((row + col) % 3) + 1;

  const shape = polygon(MATRIX_CELL / 2, MATRIX_CELL / 2 - 4, 34, sides, rotation);
  const dots = Array.from({ length: dotCount }, (_, index) =>
    circle(MATRIX_CELL / 2 + (index - (dotCount - 1) / 2) * 16, MATRIX_CELL - 14, 5, "solid"),
  ).join("");

  return shape + dots;
}

/** Serbest kurallı hücre (şıklar için): kenar sayısı, dönüş ve nokta sayısı ayrı ayrı verilir. */
function matrixThreeRulesCell(sides, rotationDeg, dotCount) {
  const shape = polygon(MATRIX_CELL / 2, MATRIX_CELL / 2 - 4, 34, sides, -90 + rotationDeg);
  const dots = Array.from({ length: dotCount }, (_, index) =>
    circle(MATRIX_CELL / 2 + (index - (dotCount - 1) / 2) * 16, MATRIX_CELL - 14, 5, "solid"),
  ).join("");
  return shape + dots;
}

// ---------------------------------------------------------------------------
// 1b) Şekil serisi
// ---------------------------------------------------------------------------

const SERIES_CELL = 104;

/**
 * Şekil serisindeki tek bir kare: köşelerden birinde dolu nokta ve içinde bir şekil bulunur.
 *  - Nokta her adımda saat yönünde bir köşe ilerler (4 adımda tur tamamlar).
 *  - İçteki şekil her adımda daire ↔ üçgen olarak değişir.
 */
function seriesCell(step) {
  const corners = [
    [24, 24],
    [SERIES_CELL - 24, 24],
    [SERIES_CELL - 24, SERIES_CELL - 24],
    [24, SERIES_CELL - 24],
  ];
  const [dotX, dotY] = corners[step % 4];
  const inner =
    step % 2 === 0
      ? circle(SERIES_CELL / 2, SERIES_CELL / 2, 18)
      : triangle(SERIES_CELL / 2, SERIES_CELL / 2, 38);

  return `<rect class="frame" x="2" y="2" width="${SERIES_CELL - 4}" height="${SERIES_CELL - 4}" rx="6" />${inner}${circle(dotX, dotY, 7, "solid")}`;
}

/** Şıklar için tek kare: nokta köşesi ve iç şekil ayrı ayrı verilir. */
function seriesOptionSvg(cornerIndex, innerIsCircle) {
  const corners = [
    [24, 24],
    [SERIES_CELL - 24, 24],
    [SERIES_CELL - 24, SERIES_CELL - 24],
    [24, SERIES_CELL - 24],
  ];
  const [dotX, dotY] = corners[cornerIndex % 4];
  const inner = innerIsCircle
    ? circle(SERIES_CELL / 2, SERIES_CELL / 2, 18)
    : triangle(SERIES_CELL / 2, SERIES_CELL / 2, 38);

  const body = `<rect class="frame" x="2" y="2" width="${SERIES_CELL - 4}" height="${SERIES_CELL - 4}" rx="6" />${inner}${circle(dotX, dotY, 7, "solid")}`;
  return svgDocument(SERIES_CELL, SERIES_CELL, body);
}

/** Soruda gösterilen şerit: ilk dört adım ve sonunda soru işareti. */
function seriesPromptSvg(stepCount) {
  const gap = 10;
  const width = (SERIES_CELL + gap) * (stepCount + 1) - gap;
  let body = "";

  for (let step = 0; step < stepCount; step += 1) {
    body += group(`translate(${step * (SERIES_CELL + gap)} 0)`, seriesCell(step));
  }

  const lastX = stepCount * (SERIES_CELL + gap);
  body += `<rect class="frame" x="${lastX + 2}" y="2" width="${SERIES_CELL - 4}" height="${SERIES_CELL - 4}" rx="6" />`;
  body += `<text class="label" x="${lastX + SERIES_CELL / 2}" y="${SERIES_CELL / 2 + 12}">?</text>`;

  return svgDocument(width, SERIES_CELL, body);
}

// ---------------------------------------------------------------------------
// 2) Uzamsal düşünme soruları
// ---------------------------------------------------------------------------

const FIGURE_SIZE = 130;

/**
 * Asimetrik bir "bayrak" figürü: döndürüldüğünde tanınabilir, aynalandığında farklıdır.
 * Bu ayrım, "döndürülmüş hali hangisi?" sorusunun ayırt edici noktasıdır.
 */
const FLAG_FIGURE = `
  <path class="line" d="M 30 100 L 30 25 L 85 40 L 55 55 L 75 70 L 30 70" />
  <circle class="solid" cx="30" cy="100" r="6" />
`;

/** "L" biçimli dört kareli figür (tetromino). */
const L_FIGURE = `
  <path class="line" d="M 35 25 L 60 25 L 60 80 L 100 80 L 100 105 L 35 105 Z" />
`;

/**
 * Figürü döndürür ve isteğe bağlı olarak aynalar.
 * @param mirrored true ise figür yatay eksende aynalanır (yani artık aynı cisim değildir).
 */
function figureSvg(figure, rotationDeg, mirrored = false) {
  const center = FIGURE_SIZE / 2;
  const mirror = mirrored ? `translate(${FIGURE_SIZE} 0) scale(-1 1)` : "";
  const body = `<rect class="frame" x="0" y="0" width="${FIGURE_SIZE}" height="${FIGURE_SIZE}" rx="6" />
    ${group(`${mirror} rotate(${rotationDeg} ${center} ${center})`, figure)}`;
  return svgDocument(FIGURE_SIZE, FIGURE_SIZE, body);
}

const ISO_UNIT = 24;

/**
 * İzometrik küp: verilen ızgara konumundaki birim küpü üç yüzüyle çizer.
 * Yüzler dolgulu çizilir; böylece öndeki küp arkadakini kapatır ve cisim üç boyutlu okunur.
 * @returns Çizim metni ve kapladığı köşe noktaları (çerçeveye ortalamak için).
 */
function isoCube(gridX, gridY, gridZ) {
  const x = (gridX - gridY) * ISO_UNIT;
  const y = (gridX + gridY) * ISO_UNIT * 0.5 - gridZ * ISO_UNIT;
  const u = ISO_UNIT;

  const faces = [
    ["face-top", [[x, y], [x + u, y + u * 0.5], [x, y + u], [x - u, y + u * 0.5]]],
    ["face-left", [[x - u, y + u * 0.5], [x, y + u], [x, y + u * 2], [x - u, y + u * 1.5]]],
    ["face-right", [[x + u, y + u * 0.5], [x, y + u], [x, y + u * 2], [x + u, y + u * 1.5]]],
  ];

  const markup = faces
    .map(
      ([className, points]) =>
        `<polygon class="face ${className}" points="${points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ")}" />`,
    )
    .join("");

  return { markup, points: faces.flatMap(([, points]) => points) };
}

/**
 * Küplerden oluşan bir cismi çizer ve çerçeveye ortalar.
 * @param cubes [x, y, z] üçlüleri.
 * @param turns Cismi dikey eksen etrafında 90°'nin katlarıyla döndürür (aynı cisim kalır).
 * @param mirrored true ise cisim aynalanır (artık aynı cisim değildir).
 */
function isoFigureSvg(cubes, turns = 0, mirrored = false) {
  const width = 190;
  const height = 170;

  // Dikey eksen etrafında döndürme: (x, y) → (y, -x). Küp koordinatları tam sayı kalır.
  let transformed = cubes.map(([x, y, z]) => [x, y, z]);
  for (let turn = 0; turn < ((turns % 4) + 4) % 4; turn += 1) {
    transformed = transformed.map(([x, y, z]) => [y, -x, z]);
  }
  if (mirrored) {
    transformed = transformed.map(([x, y, z]) => [x, -y, z]);
  }

  // Çizim sırası: arkadaki küpler önce çizilir ki öndekiler onları kapatsın.
  // İzometrik görünümde "arka", x + y toplamı küçük ve z'si düşük olan küptür.
  const ordered = [...transformed].sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[2] - b[2]);
  const drawn = ordered.map(([x, y, z]) => isoCube(x, y, z));

  // Cismi çerçevenin ortasına taşı (dönüş sonrası kayma olmasın diye her seferinde hesaplanır).
  const allPoints = drawn.flatMap((cube) => cube.points);
  const minX = Math.min(...allPoints.map(([px]) => px));
  const maxX = Math.max(...allPoints.map(([px]) => px));
  const minY = Math.min(...allPoints.map(([, py]) => py));
  const maxY = Math.max(...allPoints.map(([, py]) => py));
  const offsetX = width / 2 - (minX + maxX) / 2;
  const offsetY = height / 2 - (minY + maxY) / 2;

  const body =
    `<rect class="frame" x="0" y="0" width="${width}" height="${height}" rx="6" />` +
    group(
      `translate(${offsetX.toFixed(1)} ${offsetY.toFixed(1)})`,
      drawn.map((cube) => cube.markup).join(""),
    );

  return svgDocument(width, height, body);
}

// ---------------------------------------------------------------------------
// 3) Kağıt katlama soruları
// ---------------------------------------------------------------------------

const PAPER = 120;

/** Katlama adımlarını gösteren şerit: açık kağıt → katlanmış kağıt (delikli). */
function foldingPromptSvg({ folds, holes }) {
  const gap = 30;
  const width = PAPER * 2 + gap + 40;
  const height = PAPER + 20;
  let body = "";

  // 1. panel: açık kağıt ve katlama çizgisi/okları
  body += `<rect class="frame" x="0" y="10" width="${PAPER}" height="${PAPER}" rx="4" />`;
  body += `<line class="dashed" x1="${PAPER / 2}" y1="10" x2="${PAPER / 2}" y2="${PAPER + 10}" />`;
  if (folds === 2) {
    body += `<line class="dashed" x1="0" y1="${PAPER / 2 + 10}" x2="${PAPER}" y2="${PAPER / 2 + 10}" />`;
  }

  // Aradaki ok: "katlanır" anlamında
  const arrowX = PAPER + gap / 2;
  body += `<path class="line" d="M ${arrowX - 12} ${PAPER / 2 + 10} L ${arrowX + 12} ${PAPER / 2 + 10} M ${arrowX + 4} ${PAPER / 2 + 2} L ${arrowX + 12} ${PAPER / 2 + 10} L ${arrowX + 4} ${PAPER / 2 + 18}" />`;

  // 2. panel: katlanmış kağıt (genişlik yarıya, iki katta yükseklik de yarıya iner) ve delikler
  const foldedX = PAPER + gap + 12;
  const foldedWidth = PAPER / 2;
  const foldedHeight = folds === 2 ? PAPER / 2 : PAPER;
  body += `<rect class="frame" x="${foldedX}" y="10" width="${foldedWidth}" height="${foldedHeight}" rx="4" />`;
  body += holes
    .map(([hx, hy]) => circle(foldedX + hx * foldedWidth, 10 + hy * foldedHeight, 8, "solid"))
    .join("");

  return svgDocument(width, height, body);
}

/** Açılmış kağıdı, üzerindeki delik desenleriyle çizer (şıklar için). */
function foldingOptionSvg(holes) {
  const body =
    `<rect class="frame" x="10" y="10" width="${PAPER}" height="${PAPER}" rx="4" />` +
    holes.map(([hx, hy]) => circle(10 + hx * PAPER, 10 + hy * PAPER, 8, "solid")).join("");
  return svgDocument(PAPER + 20, PAPER + 20, body);
}

// ---------------------------------------------------------------------------
// 4) Şekil eşleştirme (hız görevi) sembolleri
// ---------------------------------------------------------------------------

/**
 * Birbirine benzeyen ama tek bir ayrıntıda ayrılan şekiller: kare, köşesi kesik kare,
 * çentikli kare, çaprazlı kare, noktalı kare. Hızlı ama dikkatli bakmayı gerektirir.
 */
const MATCH_SHAPES = {
  a: `<rect class="line" x="12" y="12" width="56" height="56" rx="4" />`,
  b: `<path class="line" d="M 12 12 L 54 12 L 68 26 L 68 68 L 12 68 Z" />`,
  c: `<path class="line" d="M 12 12 L 68 12 L 68 68 L 12 68 Z M 40 12 L 40 34" />`,
  d: `<rect class="line" x="12" y="12" width="56" height="56" rx="4" /><line class="line" x1="12" y1="12" x2="68" y2="68" />`,
  e: `<rect class="line" x="12" y="12" width="56" height="56" rx="4" /><circle class="solid" cx="40" cy="40" r="7" />`,
};

function matchShapeSvg(key) {
  return svgDocument(80, 80, MATCH_SHAPES[key]);
}

// ---------------------------------------------------------------------------
// Üretim
// ---------------------------------------------------------------------------

/** Üretilecek tüm dosyalar: "<soru-kimliği>/<dosya adı>" → SVG içeriği. */
function buildFiles() {
  const files = new Map();
  const add = (questionId, name, content) => files.set(`${questionId}/${name}`, content);

  // --- Görsel matris ---
  // matris-01: satır = şekil, sütun = adet. Aranan hücre: 3 üçgen.
  add("matris-01", "matris.svg", matrixSvg((row, col) =>
    row === 2 && col === 2 ? undefined : matrixShapeCount(row, col),
  ));
  add("matris-01", "a.svg", cellOptionSvg(matrixShapeCount(2, 1))); // 2 üçgen
  add("matris-01", "b.svg", cellOptionSvg(matrixShapeCount(2, 2))); // 3 üçgen (doğru)
  add("matris-01", "c.svg", cellOptionSvg(matrixShapeCount(1, 2))); // 3 kare
  add("matris-01", "d.svg", cellOptionSvg(matrixShapeCount(0, 2))); // 3 daire

  // matris-02: sütun = 45° dönüş, satır = nokta sayısı.
  add("matris-02", "matris.svg", matrixSvg((row, col) =>
    row === 2 && col === 2 ? undefined : matrixRotateDots(row, col),
  ));
  add("matris-02", "a.svg", cellOptionSvg(matrixRotateDots(2, 2))); // doğru
  add("matris-02", "b.svg", cellOptionSvg(matrixRotateDots(1, 2))); // nokta eksik
  add("matris-02", "c.svg", cellOptionSvg(matrixRotateDots(2, 1))); // dönüş eksik
  add("matris-02", "d.svg", cellOptionSvg(matrixRotateDots(0, 0))); // ilk hücre

  // matris-03: kenar sayısı satır ve sütunla artar.
  add("matris-03", "matris.svg", matrixSvg((row, col) =>
    row === 2 && col === 2 ? undefined : matrixPolygonSides(row, col),
  ));
  add("matris-03", "a.svg", cellOptionSvg(polygon(55, 55, 38, 6))); // altıgen
  add("matris-03", "b.svg", cellOptionSvg(polygon(55, 55, 38, 7))); // yedigen (doğru)
  add("matris-03", "c.svg", cellOptionSvg(polygon(55, 55, 38, 8))); // sekizgen
  add("matris-03", "d.svg", cellOptionSvg(polygon(55, 55, 38, 5))); // beşgen

  // matris-04: üçüncü sütun = ilk iki sütunun simetrik farkı.
  add("matris-04", "matris.svg", matrixSvg((row, col) =>
    row === 2 && col === 2 ? undefined : matrixSymmetricDifference(row, col),
  ));
  add("matris-04", "a.svg", cellOptionSvg(matrixSymmetricDifference(2, 2))); // doğru
  add("matris-04", "b.svg", cellOptionSvg(matrixSymmetricDifference(2, 0))); // ilk hücre
  add("matris-04", "c.svg", cellOptionSvg(matrixSymmetricDifference(0, 2))); // başka satırın cevabı
  add("matris-04", "d.svg", cellOptionSvg(matrixSymmetricDifference(1, 1))); // ilgisiz

  /**
   * matris-05: üç kural birlikte işler (kenar sayısı, dönüş, nokta sayısı).
   * Aranan hücre (3. satır, 3. sütun): beşgen, 80° dönüş, ((2+2) mod 3) + 1 = 2 nokta.
   */
  add("matris-05", "matris.svg", matrixSvg((row, col) =>
    row === 2 && col === 2 ? undefined : matrixThreeRules(row, col),
  ));
  add("matris-05", "a.svg", cellOptionSvg(matrixThreeRulesCell(5, 80, 3))); // nokta sayısı yanlış
  add("matris-05", "b.svg", cellOptionSvg(matrixThreeRulesCell(5, 80, 2))); // doğru
  add("matris-05", "c.svg", cellOptionSvg(matrixThreeRulesCell(4, 80, 2))); // kenar sayısı yanlış
  add("matris-05", "d.svg", cellOptionSvg(matrixThreeRulesCell(5, 40, 2))); // dönüş yanlış

  /**
   * seri-01: dört adımlık şekil serisi; beşinci adım aranır.
   * 5. adım (index 4): nokta 4 mod 4 = 0 → sol üst köşe; iç şekil 4 çift → daire.
   */
  add("seri-01", "seri.svg", seriesPromptSvg(4));
  add("seri-01", "a.svg", seriesOptionSvg(0, true)); // doğru
  add("seri-01", "b.svg", seriesOptionSvg(1, true)); // nokta bir köşe ileride
  add("seri-01", "c.svg", seriesOptionSvg(0, false)); // iç şekil yanlış
  add("seri-01", "d.svg", seriesOptionSvg(3, true)); // nokta bir köşe geride

  // --- Uzamsal düşünme ---
  // uzamsal-01: bayrak figürünün 90° döndürülmüş hali (tek doğru).
  add("uzamsal-01", "soru.svg", figureSvg(FLAG_FIGURE, 0));
  add("uzamsal-01", "a.svg", figureSvg(FLAG_FIGURE, 0, true)); // ayna
  add("uzamsal-01", "b.svg", figureSvg(FLAG_FIGURE, 90)); // doğru
  add("uzamsal-01", "c.svg", figureSvg(FLAG_FIGURE, 180, true)); // ayna + dönüş
  add("uzamsal-01", "d.svg", figureSvg(FLAG_FIGURE, 90, true)); // ayna + dönüş

  // uzamsal-02: L figürü; iki şık doğru dönüş, ikisi ayna (çoklu seçim).
  add("uzamsal-02", "soru.svg", figureSvg(L_FIGURE, 0));
  add("uzamsal-02", "a.svg", figureSvg(L_FIGURE, 90)); // doğru
  add("uzamsal-02", "b.svg", figureSvg(L_FIGURE, 180, true)); // ayna
  add("uzamsal-02", "c.svg", figureSvg(L_FIGURE, 270)); // doğru
  add("uzamsal-02", "d.svg", figureSvg(L_FIGURE, 0, true)); // ayna

  /**
   * uzamsal-03: üç küplü "L" cisim.
   *
   * ÖNEMLİ: Bu cismin ayna görüntüsü, cismin döndürülmüş halinden ayırt edilemez (düzlemsel
   * L-tromino aynalandığında yine kendisine döner). Bu yüzden burada ayna şıkkı KULLANILMAZ;
   * yanlış şıklar küp sayısı veya dizilimi farklı olan cisimlerdir.
   */
  const SHAPE_L = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
  ];
  add("uzamsal-03", "soru.svg", isoFigureSvg(SHAPE_L, 0));
  add("uzamsal-03", "a.svg", isoFigureSvg(SHAPE_L, 1)); // doğru (90° dönüş)
  add("uzamsal-03", "b.svg", isoFigureSvg([[0, 0, 0], [1, 0, 0], [1, 0, 1]], 0)); // dikey kollu
  add("uzamsal-03", "c.svg", isoFigureSvg([...SHAPE_L, [0, 1, 0]], 1)); // fazladan küp
  add("uzamsal-03", "d.svg", isoFigureSvg(SHAPE_L.slice(0, 2), 2)); // eksik küp

  /**
   * uzamsal-04: dört küplü cisim — üçlü sıra ve bir ucunda yükselen küp.
   *
   * İzometrik görünümde (x, y, z) ile (x+1, y+1, z+1) konumundaki küpler ekranda tam olarak
   * üst üste düşer; bu yüzden cisim, böyle bir çift içermeyecek şekilde seçilmiştir (tüm
   * küpler y = 0 düzleminde veya üstünde). Yanlış şıklar küp sayısı ya da yükselen küpün
   * yeri ile ayrılır; ayna görüntüsü çeldirici olarak kullanılmaz, çünkü bu cismin aynası
   * 180° döndürülmüş haliyle aynıdır.
   */
  const SHAPE_ROW = [
    [0, 0, 0],
    [1, 0, 0],
    [2, 0, 0],
    [0, 0, 1],
  ];
  add("uzamsal-04", "soru.svg", isoFigureSvg(SHAPE_ROW, 0));
  add("uzamsal-04", "a.svg", isoFigureSvg(SHAPE_ROW, 1)); // doğru (90° dönüş)
  add("uzamsal-04", "b.svg", isoFigureSvg(
    [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 0, 1]], // yükselen küp ortada → farklı cisim
    1,
  ));
  add("uzamsal-04", "c.svg", isoFigureSvg(SHAPE_ROW.slice(0, 3), 1)); // yükselen küp yok
  add("uzamsal-04", "d.svg", isoFigureSvg([...SHAPE_ROW, [2, 0, 1]], 0)); // fazladan küp

  // --- Kağıt katlama ---
  // katlama-01: bir kez katlanır, tek delik → açılınca dikey eksende simetrik iki delik.
  add("katlama-01", "soru.svg", foldingPromptSvg({ folds: 1, holes: [[0.5, 0.35]] }));
  add("katlama-01", "a.svg", foldingOptionSvg([[0.25, 0.35]])); // tek delik
  add("katlama-01", "b.svg", foldingOptionSvg([[0.25, 0.35], [0.75, 0.35]])); // doğru
  add("katlama-01", "c.svg", foldingOptionSvg([[0.25, 0.35], [0.25, 0.65]])); // yanlış eksen
  add("katlama-01", "d.svg", foldingOptionSvg([[0.5, 0.35], [0.5, 0.65]])); // ortada iki delik

  // katlama-02: iki kez katlanır (dikey + yatay), tek delik → açılınca dört delik.
  add("katlama-02", "soru.svg", foldingPromptSvg({ folds: 2, holes: [[0.5, 0.5]] }));
  add("katlama-02", "a.svg", foldingOptionSvg([[0.25, 0.25], [0.75, 0.25]])); // iki delik
  add("katlama-02", "b.svg", foldingOptionSvg([[0.25, 0.25], [0.25, 0.75]])); // iki delik
  add("katlama-02", "c.svg", foldingOptionSvg([
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ])); // doğru
  add("katlama-02", "d.svg", foldingOptionSvg([
    [0.5, 0.25],
    [0.5, 0.75],
    [0.25, 0.5],
    [0.75, 0.5],
  ])); // yanlış konumlar

  // --- Hız görevi: şekil eşleştirme sembolleri ---
  for (const key of Object.keys(MATCH_SHAPES)) {
    add("hiz-02", `${key}.svg`, matchShapeSvg(key));
  }

  return files;
}

async function main() {
  const files = buildFiles();

  for (const [relativePath, content] of files) {
    const target = path.join(PUBLIC_QUESTIONS_DIR, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  console.log(`${files.size} SVG dosyası üretildi: public/questions/`);
}

await main();
