import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const PDF_MARGIN = 24;
const RENDER_SCALE = 2;
const IMAGE_QUALITY = 0.92;

const waitForImages = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) {
        try {
          await image.decode?.();
        } catch {}
        return;
      }

      await new Promise<void>((resolve) => {
        const cleanup = () => {
          image.removeEventListener("load", handleLoad);
          image.removeEventListener("error", handleLoad);
        };

        const handleLoad = () => {
          cleanup();
          resolve();
        };

        image.addEventListener("load", handleLoad, { once: true });
        image.addEventListener("error", handleLoad, { once: true });
      });
    }),
  );
};

const sliceCanvasForPdf = (canvas: HTMLCanvasElement) => {
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const renderWidth = pageWidth - PDF_MARGIN * 2;
  const renderHeight = pageHeight - PDF_MARGIN * 2;
  const slicePixelHeight = Math.max(
    1,
    Math.floor((renderHeight * canvas.width) / renderWidth),
  );
  const slices: HTMLCanvasElement[] = [];

  for (let offsetY = 0; offsetY < canvas.height; offsetY += slicePixelHeight) {
    const height = Math.min(slicePixelHeight, canvas.height - offsetY);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = height;

    const context = sliceCanvas.getContext("2d");
    if (!context) continue;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    context.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      height,
      0,
      0,
      canvas.width,
      height,
    );
    slices.push(sliceCanvas);
  }

  return slices;
};

async function createPdfFileFromElement(
  element: HTMLElement,
  filename: string,
) {
  await document.fonts?.ready;
  await waitForImages(element);

  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: RENDER_SCALE,
    useCORS: true,
    logging: false,
    windowWidth: Math.max(element.scrollWidth, element.clientWidth, 1280),
    windowHeight: Math.max(element.scrollHeight, element.clientHeight, 720),
  });

  const slices = sliceCanvasForPdf(canvas);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const renderWidth = pageWidth - PDF_MARGIN * 2;

  slices.forEach((sliceCanvas, index) => {
    if (index > 0) pdf.addPage();

    const renderHeight = (sliceCanvas.height * renderWidth) / sliceCanvas.width;
    const imageData = sliceCanvas.toDataURL("image/jpeg", IMAGE_QUALITY);

    pdf.addImage(
      imageData,
      "JPEG",
      PDF_MARGIN,
      PDF_MARGIN,
      renderWidth,
      renderHeight,
      undefined,
      "FAST",
    );
  });

  const blob = pdf.output("blob");
  return new File([blob], filename, { type: "application/pdf" });
}

export { createPdfFileFromElement };
