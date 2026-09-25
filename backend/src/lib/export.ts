import PDFDocument from "pdfkit";
import PptxGenJS from "pptxgenjs";

// The deck's own palette, so an exported file still looks like PitchPress
const PAPER = "FBF8F1";
const INK = "1C1A16";
const INK_SOFT = "4A463D";
const SIGNAL = "FF5A1F";
const MUTED = "8A8475";

export type ExportSlide = {
  order: number;
  title: string;
  content: string;
  imageUrl: string | null;
};

export type ExportDeck = {
  title: string | null;
  idea: string;
  slides: ExportSlide[];
};

/** Agent writes content as "• point" lines — the same split the UI uses. */
function toBullets(content: string): string[] {
  return content
    .split(/\n|(?=•)/)
    .map((line) => line.replace(/^[•\-\s]+/, "").trim())
    .filter(Boolean);
}

/** "CodeSmart: Your AI Tutor" → "codesmart-your-ai-tutor" */
export function toFileName(deck: ExportDeck, extension: string): string {
  const base = (deck.title ?? deck.idea)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `${base || "pitch-deck"}.${extension}`;
}

/**
 * Slide images live on ImageKit. A slow or broken image must not fail the whole
 * export, so each one is fetched with a timeout and skipped on error.
 */
async function fetchImage(url: string | null): Promise<{ buffer: Buffer; type: string } | null> {
  if (!url) return null;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;

    return { buffer: Buffer.from(await response.arrayBuffer()), type };
  } catch {
    return null;
  }
}

async function fetchAllImages(slides: ExportSlide[]) {
  return Promise.all(slides.map((slide) => fetchImage(slide.imageUrl)));
}

/** 16:9 PowerPoint: text on the left, image filling the right half. */
export async function buildPptx(deck: ExportDeck): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9"; // 10 x 5.625 inches
  pptx.title = deck.title ?? "Pitch deck";

  const images = await fetchAllImages(deck.slides);

  deck.slides.forEach((slide, index) => {
    const pptxSlide = pptx.addSlide();
    pptxSlide.background = { color: PAPER };

    const image = images[index];
    const textWidth = image ? 5.1 : 8.8;

    pptxSlide.addText(String(slide.order).padStart(2, "0"), {
      x: 0.6,
      y: 0.45,
      w: 1,
      h: 0.3,
      fontSize: 11,
      color: MUTED,
      fontFace: "Consolas",
    });

    pptxSlide.addText(slide.title, {
      x: 0.6,
      y: 0.85,
      w: textWidth,
      h: 1.2,
      fontSize: 32,
      bold: false,
      color: INK,
      fontFace: "Georgia",
      valign: "top",
    });

    const bullets = toBullets(slide.content);
    if (bullets.length > 0) {
      pptxSlide.addText(
        bullets.map((text) => ({ text, options: { bullet: { characterCode: "2014" }, breakLine: true } })),
        {
          x: 0.6,
          y: 2.2,
          w: textWidth,
          h: 2.8,
          fontSize: 14,
          color: INK_SOFT,
          fontFace: "Calibri",
          lineSpacingMultiple: 1.3,
          valign: "top",
        },
      );
    }

    if (image) {
      pptxSlide.addImage({
        data: `data:${image.type};base64,${image.buffer.toString("base64")}`,
        x: 5.9,
        y: 0,
        w: 4.1,
        h: 5.625,
        sizing: { type: "cover", w: 4.1, h: 5.625 },
      });
    }

    // Thin accent rule under the title
    pptxSlide.addShape("rect", { x: 0.6, y: 1.95, w: 0.6, h: 0.03, fill: { color: SIGNAL } });
  });

  // pptxgenjs types the nodebuffer case loosely
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

/** Same layout as a PDF, one landscape page per slide. */
export async function buildPdf(deck: ExportDeck): Promise<Buffer> {
  const images = await fetchAllImages(deck.slides);

  const WIDTH = 960;
  const HEIGHT = 540;
  const doc = new PDFDocument({ size: [WIDTH, HEIGHT], margin: 0, autoFirstPage: false });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  deck.slides.forEach((slide, index) => {
    doc.addPage({ size: [WIDTH, HEIGHT], margin: 0 });
    doc.rect(0, 0, WIDTH, HEIGHT).fill(`#${PAPER}`);

    const image = images[index];
    const imageWidth = image ? 380 : 0;
    const textWidth = WIDTH - imageWidth - 120;

    if (image) {
      try {
        doc.save();
        doc.rect(WIDTH - imageWidth, 0, imageWidth, HEIGHT).clip();
        doc.image(image.buffer, WIDTH - imageWidth, 0, { cover: [imageWidth, HEIGHT], align: "center", valign: "center" });
        doc.restore();
      } catch {
        // Unsupported image format (PDFKit takes JPEG/PNG only) — text still exports
        doc.restore();
      }
    }

    doc
      .fillColor(`#${MUTED}`)
      .font("Courier")
      .fontSize(11)
      .text(String(slide.order).padStart(2, "0"), 60, 56);

    doc
      .fillColor(`#${INK}`)
      .font("Times-Roman")
      .fontSize(34)
      .text(slide.title, 60, 86, { width: textWidth });

    const afterTitle = doc.y + 14;
    doc.rect(60, afterTitle, 34, 2).fill(`#${SIGNAL}`);

    let y = afterTitle + 26;
    doc.font("Helvetica").fontSize(13).fillColor(`#${INK_SOFT}`);

    for (const bullet of toBullets(slide.content)) {
      if (y > HEIGHT - 60) break; // don't spill off the page
      doc.rect(60, y + 7, 9, 1.5).fill(`#${SIGNAL}`);
      doc.fillColor(`#${INK_SOFT}`).text(bullet, 82, y, { width: textWidth - 22 });
      y = doc.y + 12;
    }
  });

  doc.end();
  return finished;
}
