const EMPTY_RICH_TEXT_PATTERN =
  /^(?:\s|<p><\/p>|<p><br\/?><\/p>|<br\/?>|&nbsp;|<div><\/div>|<div><br\/?><\/div>)*$/i;

export function isRichTextEmpty(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return true;

  return EMPTY_RICH_TEXT_PATTERN.test(normalized);
}

export function normalizeRichText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return isRichTextEmpty(normalized) ? "" : normalized;
}

export function richTextToPlainText(value: string | null | undefined) {
  const normalized = normalizeRichText(value);
  if (!normalized) return "";

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(normalized, "text/html");
    return doc.body.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  return normalized
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}
