const bengaliDigits = "০১২৩৪৫৬৭৮৯";

export function normalizeNumerals(value: string): string {
  return value
    .replace(/[০-৯]/g, (digit) => String(bengaliDigits.indexOf(digit)))
    .replace(/[٫]/g, ".")
    .replace(/[،]/g, ",");
}

export function parseNumericInput(value: string): number | null {
  const normalized = normalizeNumerals(value.trim());
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseYearValues(value: string): number[] | null {
  const parts = normalizeNumerals(value).split(",").map((part) => part.trim());
  if (parts.length !== 3 || parts.some((part) => part === "")) return null;

  const values = parts.map(Number);
  return values.every((number) => Number.isFinite(number) && number >= 0) ? values : null;
}

export function movingAverage(values: number[]): number | null {
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function formatBengaliNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("bn-BD", { maximumFractionDigits }).format(value);
}
