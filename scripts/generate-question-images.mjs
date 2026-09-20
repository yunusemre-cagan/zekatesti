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

const SHAPE_DRAWERS = [
  (cx, cy) => circle(cx, cy, 13),
  (cx, cy) => square(cx, cy, 24),
  (cx, cy) => triangle(cx, cy, 28),
];

/** Hücre içeriği: belirtilen şekilden belirtilen adette, yatay ve eşit aralıklı. */
function shapeRow(shapeIndex, count) {
  const drawShape = SHAPE_DRAWERS[shapeIndex];
  return Array.from({ length: count }, (_, index) =>
    drawShape(MATRIX_CELL / 2 + (index - (count - 1) / 2) * 32, MATRIX_CELL / 2),
  ).join("");
}

/**
 * matris-01: İki bağımsız "Latin karesi" iç içe geçer.
 *  - Şekil adedi: (satır + sütun) mod 3 + 1  → her satırda ve her sütunda 1, 2, 3 birer kez.
 *  - Şekil türü:  (satır − sütun) mod 3      → her satırda ve her sütunda daire, kare, üçgen birer kez.
 *
 * Kurallar çapraz yönde ilerlediği için ne tek başına satıra ne de tek başına sütuna bakarak
 * çözülemez; iki kuralın birlikte görülmesi gerekir.
 */
function matrixShapeCount(row, col) {
  const count = ((row + col) % 3) + 1;
  const shapeIndex = (row - col + 3) % 3;
  return shapeRow(shapeIndex, count);
}

/** Ok ve altındaki noktalar; dönüş açısı ve nokta sayısı serbestçe verilir. */
function arrowCell(rotationDeg, dotCount) {
  const center = MATRIX_CELL / 2;
  const arrow = `<path class="line" d="M ${center} ${center + 26} L ${center} ${center - 26} M ${center - 11} ${center - 15} L ${center} ${center - 26} L ${center + 11} ${center - 15}" />`;
  const rotated = group(`rotate(${rotationDeg} ${center} ${center})`, arrow);

  const dots = Array.from({ length: dotCount }, (_, index) =>
    circle(center + (index - (dotCount - 1) / 2) * 18, MATRIX_CELL - 14, 5, "solid"),
  ).join("");

  return rotated + dots;
}

/**
 * matris-02: İki kural da çapraz ilerler; satır ya da sütun tek başına yeterli değildir.
 *  - Dönüş açısı: (satır + sütun) × 45°  → sol üstte yukarı, sağ altta aşağı bakar.
 *  - Nokta sayısı: (satır − sütun) mod 3 + 1 → her satırda ve sütunda 1, 2, 3 birer kez.
 */
function matrixRotateDots(row, col) {
  return arrowCell((row + col) * 45, ((row - col + 3) % 3) + 1);
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

const SERIES_CORNERS = [
  [24, 24],
  [SERIES_CELL - 24, 24],
  [SERIES_CELL - 24, SERIES_CELL - 24],
  [24, SERIES_CELL - 24],
];

/** Seri karesinin içeriği: köşe noktası + iç şekil (0 daire, 1 üçgen, 2 kare). */
function seriesCellContent(cornerIndex, shapeIndex) {
  const [dotX, dotY] = SERIES_CORNERS[cornerIndex % 4];
  const center = SERIES_CELL / 2;
  const inner = [
    () => circle(center, center, 18),
    () => triangle(center, center, 38),
    () => square(center, center, 34),
  ][shapeIndex % 3]();

  return `<rect class="frame" x="2" y="2" width="${SERIES_CELL - 4}" height="${SERIES_CELL - 4}" rx="6" />${inner}${circle(dotX, dotY, 7, "solid")}`;
}

/**
 * seri-01: İki kural farklı periyotlarda ilerler; bu yüzden "bir sonraki" tahmin edilirken
 * ikisini ayrı ayrı takip etmek gerekir.
 *  - Köşedeki nokta her adımda saat yönünde bir köşe ilerler (periyot 4).
 *  - İçteki şekil daire → üçgen → kare sırasını izler (periyot 3).
 * Periyotlar farklı olduğu için desen ancak 12 adımda tekrar eder; "bir önceki gibi olur"
 * kestirmesi yanlış sonuç verir.
 */
function seriesCell(step) {
  return seriesCellContent(step % 4, step % 3);
}

/** Şıklar için tek kare: köşe ve iç şekil ayrı ayrı verilir. */
function seriesOptionSvg(cornerIndex, shapeIndex) {
  return svgDocument(SERIES_CELL, SERIES_CELL, seriesCellContent(cornerIndex, shapeIndex));
}

/**
 * seri-02: Ok her adımda 60° döner (periyot 6), altındaki nokta sayısı 1-2-3 sırasını
 * izler (periyot 3). İki kuralın periyodu farklıdır.
 */
function series2Cell(step) {
  return arrowCell(step * 60, (step % 3) + 1);
}

/** Soruda gösterilen şerit: ilk adımlar ve sonunda soru işareti. */
function seriesPromptSvg(stepCount, renderCell = seriesCell) {
  const gap = 10;
  const width = (SERIES_CELL + gap) * (stepCount + 1) - gap;
  let body = "";

  for (let step = 0; step < stepCount; step += 1) {
    body += group(`translate(${step * (SERIES_CELL + gap)} 0)`, renderCell(step));
  }

  const lastX = stepCount * (SERIES_CELL + gap);
  body += `<rect class="frame" x="${lastX + 2}" y="2" width="${SERIES_CELL - 4}" height="${SERIES_CELL - 4}" rx="6" />`;
  body += `<text class="label" x="${lastX + SERIES_CELL / 2}" y="${SERIES_CELL / 2 + 12}">?</text>`;

  return svgDocument(width, SERIES_CELL, body);
}

// ---------------------------------------------------------------------------
// 1c) Latin karesi (kısıt çıkarımı) ve at hamlesi tahtası
// ---------------------------------------------------------------------------

const GRID_CELL = 74;

/**
 * Kare ızgara çizer. `cellContent(row, col)` hücre içeriğini üretir; boş metin dönerse
 * hücre boş bırakılır. `highlight` verilen hücreyi vurgular (aranan hücre).
 */
function gridBody(size, cellContent, highlight, offsetX = 0, offsetY = 0) {
  let body = "";

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const x = offsetX + col * GRID_CELL;
      const y = offsetY + row * GRID_CELL;
      const isHighlighted = highlight !== undefined && highlight[0] === row && highlight[1] === col;

      body += `<rect class="${isHighlighted ? "line" : "frame"}" x="${x}" y="${y}" width="${GRID_CELL}" height="${GRID_CELL}" ${isHighlighted ? 'stroke-width="3.5"' : ""} />`;

      const content = cellContent(row, col);
      if (content !== "") {
        body += `<text class="label" x="${x + GRID_CELL / 2}" y="${y + GRID_CELL / 2 + 12}">${content}</text>`;
      }
    }
  }
  return body;
}

/** Tek bir ızgarayı kendi başına bir SVG belgesi olarak döner. */
function gridSvg(size, cellContent, highlight) {
  const board = GRID_CELL * size;
  return svgDocument(board, board, gridBody(size, cellContent, highlight));
}

/**
 * latin-01: 4×4 Latin karesi. Her satırda ve her sütunda 1-4 rakamları birer kez bulunur.
 * Bulmaca tek çözümlüdür ve aranan hücre yalnızca kendi satırına ve sütununa bakarak
 * bulunamaz; önce başka hücrelerin çözülmesi gerekir (scripts/… içindeki arama ile doğrulandı).
 */
const LATIN_PUZZLE = [
  [0, 0, 0, 0],
  [0, 0, 1, 2],
  [0, 1, 4, 3],
  [4, 3, 2, 1],
];

function latinSquareSvg() {
  return gridSvg(
    4,
    (row, col) => {
      if (row === 0 && col === 0) return "?";
      const value = LATIN_PUZZLE[row][col];
      return value === 0 ? "" : String(value);
    },
    [0, 0],
  );
}

/**
 * at-01: Tek görselde iki tahta — solda hareket kuralı, sağda soru tahtası.
 *
 * Sol tahta: ortadaki taştan gidilebilen sekiz kare noktayla işaretlidir; böylece satranç
 * bilgisi gerekmez. Sağ tahta: başlangıç A (sol alt köşe), hedef B (tam orta). Bu iki kare
 * arasında en az dört hamle gerekir; "iki hamle" sezgisi yanlıştır (BFS ile doğrulandı).
 */
function knightQuestionSvg() {
  const KNIGHT_OFFSETS = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  const reachable = new Set(KNIGHT_OFFSETS.map(([dr, dc]) => `${2 + dr},${2 + dc}`));

  const boardSize = GRID_CELL * 5;
  const gap = 60;
  const titleHeight = 40;
  const width = boardSize * 2 + gap;
  const height = boardSize + titleHeight;

  const title = (text, x) =>
    `<text class="label" style="font-size:26px" x="${x + boardSize / 2}" y="26">${text}</text>`;

  const body =
    title("Hareket kuralı", 0) +
    gridBody(
      5,
      (row, col) => {
        if (row === 2 && col === 2) return "●";
        return reachable.has(`${row},${col}`) ? "×" : "";
      },
      undefined,
      0,
      titleHeight,
    ) +
    title("Tahta", boardSize + gap) +
    gridBody(
      5,
      (row, col) => {
        if (row === 4 && col === 0) return "A";
        if (row === 2 && col === 2) return "B";
        return "";
      },
      undefined,
      boardSize + gap,
      titleHeight,
    );

  return svgDocument(width, height, body);
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

/**
 * Katlama adımlarını gösteren şerit: açık kağıt (katlama çizgileriyle) → katlanmış kağıt (delikli).
 *
 * Katlama sırası: 1) dikey ortadan, 2) yatay ortadan, 3) yeniden dikey ortadan.
 * Her katlama kat sayısını ikiye katlar; tek delik tüm katlardan geçer.
 */
function foldingPromptSvg({ folds, holes }) {
  const gap = 30;
  const width = PAPER * 2 + gap + 40;
  const height = PAPER + 20;
  let body = "";

  // 1. panel: açık kağıt ve katlama çizgisi/okları
  body += `<rect class="frame" x="0" y="10" width="${PAPER}" height="${PAPER}" rx="4" />`;
  body += `<line class="dashed" x1="${PAPER / 2}" y1="10" x2="${PAPER / 2}" y2="${PAPER + 10}" />`;
  if (folds >= 2) {
    body += `<line class="dashed" x1="0" y1="${PAPER / 2 + 10}" x2="${PAPER}" y2="${PAPER / 2 + 10}" />`;
  }
  if (folds >= 3) {
    body += `<line class="dashed" x1="${PAPER / 4}" y1="10" x2="${PAPER / 4}" y2="${PAPER + 10}" />`;
  }

  // Aradaki ok: "katlanır" anlamında
  const arrowX = PAPER + gap / 2;
  body += `<path class="line" d="M ${arrowX - 12} ${PAPER / 2 + 10} L ${arrowX + 12} ${PAPER / 2 + 10} M ${arrowX + 4} ${PAPER / 2 + 2} L ${arrowX + 12} ${PAPER / 2 + 10} L ${arrowX + 4} ${PAPER / 2 + 18}" />`;

  // 2. panel: katlanmış kağıt (genişlik yarıya, iki katta yükseklik de yarıya iner) ve delikler
  const foldedX = PAPER + gap + 12;
  const foldedWidth = folds >= 3 ? PAPER / 4 : PAPER / 2;
  const foldedHeight = folds >= 2 ? PAPER / 2 : PAPER;
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
  // Aranan hücre (3. satır, 3. sütun): 2 adet daire.
  add("matris-01", "a.svg", cellOptionSvg(shapeRow(2, 2))); // doğru sayı, yanlış şekil (2 üçgen)
  add("matris-01", "b.svg", cellOptionSvg(shapeRow(0, 2))); // doğru
  add("matris-01", "c.svg", cellOptionSvg(shapeRow(0, 3))); // doğru şekil, yanlış sayı (3 daire)
  add("matris-01", "d.svg", cellOptionSvg(shapeRow(1, 1))); // ikisi de yanlış (1 kare)

  // matris-02: sütun = 45° dönüş, satır = nokta sayısı.
  add("matris-02", "matris.svg", matrixSvg((row, col) =>
    row === 2 && col === 2 ? undefined : matrixRotateDots(row, col),
  ));
  // Aranan hücre (3. satır, 3. sütun): 180° dönmüş (aşağı bakan) ok ve 1 nokta.
  add("matris-02", "a.svg", cellOptionSvg(arrowCell(180, 1))); // doğru
  add("matris-02", "b.svg", cellOptionSvg(arrowCell(180, 2))); // dönüş doğru, nokta yanlış
  add("matris-02", "c.svg", cellOptionSvg(arrowCell(135, 1))); // nokta doğru, dönüş eksik
  add("matris-02", "d.svg", cellOptionSvg(arrowCell(90, 3))); // ikisi de yanlış

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
   * seri-01: dört adım gösterilir, beşinci adım (index 4) aranır.
   * Nokta: 4 mod 4 = 0 → sol üst köşe. İç şekil: 4 mod 3 = 1 → üçgen.
   * "Şekil iki adımda bir değişiyor" diye düşünen kişi daire seçer ve yanılır.
   */
  add("seri-01", "seri.svg", seriesPromptSvg(4));
  add("seri-01", "a.svg", seriesOptionSvg(0, 1)); // doğru: sol üst köşe + üçgen
  add("seri-01", "b.svg", seriesOptionSvg(0, 0)); // köşe doğru, şekil daire (periyot 2 sanısı)
  add("seri-01", "c.svg", seriesOptionSvg(1, 1)); // şekil doğru, köşe bir ileride
  add("seri-01", "d.svg", seriesOptionSvg(0, 2)); // köşe doğru, şekil kare

  /**
   * seri-02: ok 60°'şer döner (periyot 6), nokta sayısı 1-2-3 sırasını izler (periyot 3).
   * Aranan 5. adım (index 4): 240° dönmüş ok ve 2 nokta.
   */
  add("seri-02", "seri.svg", seriesPromptSvg(4, series2Cell));
  add("seri-02", "a.svg", cellOptionSvg(arrowCell(240, 3))); // dönüş doğru, nokta yanlış
  add("seri-02", "b.svg", cellOptionSvg(arrowCell(240, 2))); // doğru
  add("seri-02", "c.svg", cellOptionSvg(arrowCell(180, 2))); // nokta doğru, dönüş eksik
  add("seri-02", "d.svg", cellOptionSvg(arrowCell(300, 1))); // ikisi de yanlış

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

  /**
   * katlama-02: üç kez katlanır (dikey → yatay → yeniden dikey), tek delik sekiz kattan geçer.
   * Katlı kağıttaki delik (0.5, 0.5) konumunda; açılınca x ekseninde dört, y ekseninde iki
   * konumda olmak üzere sekiz delik oluşur.
   */
  add("katlama-02", "soru.svg", foldingPromptSvg({ folds: 3, holes: [[0.5, 0.5]] }));
  const EIGHT_HOLES = [0.125, 0.375, 0.625, 0.875].flatMap((x) => [
    [x, 0.25],
    [x, 0.75],
  ]);
  add("katlama-02", "a.svg", foldingOptionSvg(EIGHT_HOLES.slice(0, 4))); // dört delik (bir katlama eksik sanısı)
  add("katlama-02", "b.svg", foldingOptionSvg([0.125, 0.375, 0.625, 0.875].map((x) => [x, 0.5]))); // tek sırada dört
  add("katlama-02", "c.svg", foldingOptionSvg(EIGHT_HOLES)); // doğru
  add("katlama-02", "d.svg", foldingOptionSvg([0.25, 0.75].flatMap((x) => [
    [x, 0.25],
    [x, 0.75],
  ]))); // dört delik, yanlış konumlar

  /**
   * katlama-03: iki katlama ama delik merkezde değil; açılınca dört delik simetrik fakat
   * "çeyrek merkezleri" dışında konumlanır. Konumu doğru kestirmek gerekir.
   */
  add("katlama-03", "soru.svg", foldingPromptSvg({ folds: 2, holes: [[0.6, 0.3]] }));
  add("katlama-03", "a.svg", foldingOptionSvg([
    [0.3, 0.15],
    [0.7, 0.15],
    [0.3, 0.85],
    [0.7, 0.85],
  ])); // doğru
  add("katlama-03", "b.svg", foldingOptionSvg([
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ])); // çeyrek merkezleri (ezber cevap)
  add("katlama-03", "c.svg", foldingOptionSvg([
    [0.3, 0.15],
    [0.7, 0.15],
  ])); // yalnızca üst yarı
  add("katlama-03", "d.svg", foldingOptionSvg([
    [0.15, 0.3],
    [0.85, 0.3],
    [0.15, 0.7],
    [0.85, 0.7],
  ])); // eksenler ters

  // --- Kısıt çıkarımı ve planlama ---
  add("latin-01", "izgara.svg", latinSquareSvg());
  add("at-01", "soru.svg", knightQuestionSvg());

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
