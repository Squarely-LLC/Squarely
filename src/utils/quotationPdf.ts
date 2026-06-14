import type { QuotationRecord } from "@/plugins/fake-api/handlers/apps/quotation/types";
import {
  formatCurrencyAmount,
  getVatSummary,
  loadActiveAppConfigurations,
} from "@/utils/quotationConfig";
import { normalizeRichText, richTextToPlainText } from "@/utils/richText";
import {
  getLineTotal,
  getQuotationDiscountTotal,
  getQuotationGrandTotal,
  getQuotationSubtotal,
} from "@/utils/quotationPricing";

type CreateQuotationPdfFileOptions = {
  quotationRecord: QuotationRecord;
  companyName: string;
  companyAddressLines?: string[];
  companyContactLines?: string[];
  documentLabel?: string;
  recipientLabel?: string;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN = 50;
const LINE_HEIGHT = 16;
const MAX_LINE_LENGTH = 88;

const normalizePdfText = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .trimEnd();

const escapePdfText = (value: string) =>
  normalizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapLine = (value: string, maxLength = MAX_LINE_LENGTH) => {
  const normalized = normalizePdfText(value).trim();
  if (!normalized) return [""];

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxLength) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) lines.push(currentLine);

    if (word.length <= maxLength) {
      currentLine = word;
      continue;
    }

    for (let index = 0; index < word.length; index += maxLength) {
      const chunk = word.slice(index, index + maxLength);
      if (chunk.length === maxLength) lines.push(chunk);
      else currentLine = chunk;
    }
  }

  if (currentLine) lines.push(currentLine);

  return lines;
};

const buildContentLines = ({
  quotationRecord,
  companyName,
  companyAddressLines = [],
  companyContactLines = [],
  documentLabel = "Quotation",
  recipientLabel = `${documentLabel} To`,
}: CreateQuotationPdfFileOptions) => {
  const financialConfig = loadActiveAppConfigurations().financial;
  const vatSummary = getVatSummary(financialConfig);
  const subtotal = getQuotationSubtotal(quotationRecord.purchasedProducts);
  const discount = getQuotationDiscountTotal(quotationRecord.purchasedProducts);
  const total = getQuotationGrandTotal(quotationRecord.purchasedProducts);
  const lines: string[] = [];
  const pushWrapped = (value: string) => {
    for (const line of wrapLine(value)) lines.push(line);
  };

  pushWrapped(companyName || "Squarely");
  for (const line of companyAddressLines) pushWrapped(line);
  for (const line of companyContactLines) pushWrapped(line);
  lines.push("");

  pushWrapped(`${documentLabel} ${quotationRecord.quotation.quoteNumber}`);
  pushWrapped(`Issued Date: ${quotationRecord.quotation.issuedDate}`);
  pushWrapped(`Expiry Date: ${quotationRecord.quotation.dueDate}`);
  lines.push("");

  pushWrapped(`${recipientLabel}: ${quotationRecord.quotation.client.name}`);
  if (quotationRecord.quotation.client.company.trim()) {
    pushWrapped(quotationRecord.quotation.client.company);
  }
  if (quotationRecord.quotation.client.address.trim()) {
    pushWrapped(quotationRecord.quotation.client.address);
  }
  if (quotationRecord.quotation.client.contact.trim()) {
    pushWrapped(quotationRecord.quotation.client.contact);
  }
  if (quotationRecord.quotation.client.companyEmail.trim()) {
    pushWrapped(quotationRecord.quotation.client.companyEmail);
  }
  lines.push("");

  pushWrapped("Items");
  for (const item of quotationRecord.purchasedProducts) {
    pushWrapped(
      `${item.title || "Untitled item"} | Qty ${item.hours} | Price ${formatCurrencyAmount(item.cost, financialConfig)} | Total ${formatCurrencyAmount(getLineTotal(item), financialConfig)}`,
    );
    if (item.description?.trim()) {
      item.description
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => pushWrapped(`  ${line}`));
    }
  }
  lines.push("");

  pushWrapped(`Subtotal: ${formatCurrencyAmount(subtotal, financialConfig)}`);
  pushWrapped(`Discount: ${formatCurrencyAmount(discount, financialConfig)}`);
  pushWrapped(`${vatSummary.label}: ${vatSummary.value}`);
  pushWrapped(`Total: ${formatCurrencyAmount(total, financialConfig)}`);
  if (quotationRecord.totalFx?.trim()) {
    pushWrapped(`Total FX: ${quotationRecord.totalFx}`);
  }
  lines.push("");

  pushWrapped(`Payment Method: ${quotationRecord.paymentMethod}`);
  pushWrapped(`Bank Name: ${quotationRecord.paymentDetails.bankName}`);
  pushWrapped(`Country: ${quotationRecord.paymentDetails.country}`);
  pushWrapped(`IBAN: ${quotationRecord.paymentDetails.iban}`);
  pushWrapped(`SWIFT Code: ${quotationRecord.paymentDetails.swiftCode}`);
  lines.push("");
  if (quotationRecord.showClientNote && normalizeRichText(quotationRecord.note)) {
    lines.push("");
    pushWrapped(`Terms and Notes: ${richTextToPlainText(quotationRecord.note)}`);
  }

  return lines;
};

const paginateLines = (lines: string[]) => {
  const linesPerPage = Math.floor(
    (PAGE_HEIGHT - PAGE_MARGIN * 2) / LINE_HEIGHT,
  );
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  return pages.length ? pages : [[""]];
};

const buildPdfBytes = (pages: string[][]) => {
  const encoder = new TextEncoder();
  const objects: string[] = [];
  const fontObjectId = 3;
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[fontObjectId] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let nextObjectId = 4;
  for (const pageLines of pages) {
    const pageObjectId = nextObjectId++;
    const contentObjectId = nextObjectId++;
    pageObjectIds.push(pageObjectId);
    contentObjectIds.push(contentObjectId);

    const commands = pageLines.map((line, index) => {
      const escapedLine = escapePdfText(line);
      return index === 0 ? `(${escapedLine}) Tj` : `T* (${escapedLine}) Tj`;
    });
    const stream = [
      "BT",
      "/F1 11 Tf",
      `${LINE_HEIGHT} TL`,
      `${PAGE_MARGIN} ${PAGE_HEIGHT - PAGE_MARGIN} Td`,
      ...commands,
      "ET",
    ].join("\n");

    objects[contentObjectId] =
      `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`;
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
  }

  objects[2] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    const objectBody = objects[objectId];
    if (!objectBody) continue;

    offsets[objectId] = encoder.encode(pdf).length;
    pdf += `${objectId} 0 obj\n${objectBody}\nendobj\n`;
  }

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    const offset = offsets[objectId] ?? 0;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return encoder.encode(pdf);
};

const createQuotationPdfFile = (options: CreateQuotationPdfFileOptions) => {
  const quoteNumber =
    options.quotationRecord.quotation.quoteNumber?.trim() ||
    options.documentLabel?.trim().toLowerCase() ||
    "quotation";
  const lines = buildContentLines(options);
  const bytes = buildPdfBytes(paginateLines(lines));

  return new File([bytes], `${quoteNumber}.pdf`, {
    type: "application/pdf",
  });
};

export { createQuotationPdfFile };
export type { CreateQuotationPdfFileOptions };
