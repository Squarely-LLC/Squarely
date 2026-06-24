type ProjectCodeJobLike = {
  code?: string | null;
  jobOrderNumber?: string | null;
};

export function normalizeProjectCode(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function parseJobOrderSequence(value: unknown) {
  const match = String(value ?? "").match(/^JO\d{2}\/(\d+)$/i);
  if (!match) return null;

  const sequence = Number(match[1]);
  return Number.isFinite(sequence) && sequence > 0 ? sequence : null;
}

export function nextJobOrderSequence(items: ProjectCodeJobLike[]) {
  return (
    items
      .map((job) => parseJobOrderSequence(job.jobOrderNumber))
      .filter((value): value is number => value !== null)
      .reduce((max, value) => Math.max(max, value), 0) + 1
  );
}

export function buildProjectCodePrefix(source: unknown) {
  const cleaned = String(source ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "PRJ";

  const words = cleaned.split(" ").filter(Boolean);
  const prefix =
    words.length === 1
      ? words[0].slice(0, 3)
      : words.map((word) => word[0]).join("").slice(0, 4);

  return prefix || "PRJ";
}

export function generateJobProjectCode(
  source: unknown,
  items: ProjectCodeJobLike[],
  preferredSequence = nextJobOrderSequence(items),
) {
  const prefix = buildProjectCodePrefix(source);
  const existingCodes = new Set(
    items
      .map((job) => normalizeProjectCode(job.code)?.toUpperCase())
      .filter((code): code is string => Boolean(code)),
  );
  let sequence = Math.max(1, Math.trunc(Number(preferredSequence) || 1));
  let candidate = "";

  do {
    candidate = `${prefix}-${String(sequence).padStart(3, "0")}`;
    sequence += 1;
  } while (existingCodes.has(candidate.toUpperCase()));

  return candidate;
}
