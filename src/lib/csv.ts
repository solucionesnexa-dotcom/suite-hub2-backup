// Lightweight CSV parser for invoice imports
// Supports comma or semicolon delimiter, quoted values, escaped quotes.
export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const stripped = text.replace(/^\uFEFF/, "");
  const lines = splitLines(stripped);
  if (!lines.length) return [];
  const delim = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delim).map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseLine(lines[i], delim);
    const row: CsvRow = {};
    headers.forEach((h, idx) => (row[h] = (cells[idx] ?? "").trim()));
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(headerLine: string): string {
  const semi = (headerLine.match(/;/g) || []).length;
  const comma = (headerLine.match(/,/g) || []).length;
  return semi > comma ? ";" : ",";
}

function splitLines(text: string): string[] {
  const lines: string[] = [];
  let buf = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i + 1] === '"') {
        buf += '""';
        i++;
      } else {
        inQ = !inQ;
        buf += c;
      }
    } else if ((c === "\n" || c === "\r") && !inQ) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      lines.push(buf);
      buf = "";
    } else buf += c;
  }
  if (buf.length) lines.push(buf);
  return lines;
}

function parseLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === delim && !inQ) {
      out.push(buf);
      buf = "";
    } else buf += c;
  }
  out.push(buf);
  return out;
}

export function parseAmount(value: string): number {
  if (!value) return NaN;
  // Accept "1.234,56" and "1,234.56" and "123.45"
  const trimmed = value.trim().replace(/[^\d.,-]/g, "");
  if (trimmed.includes(",") && trimmed.includes(".")) {
    if (trimmed.lastIndexOf(",") > trimmed.lastIndexOf(".")) {
      return Number(trimmed.replace(/\./g, "").replace(",", "."));
    }
    return Number(trimmed.replace(/,/g, ""));
  }
  if (trimmed.includes(",")) return Number(trimmed.replace(",", "."));
  return Number(trimmed);
}

export function parseDate(value: string): string | null {
  if (!value) return null;
  const s = value.trim();
  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${mo}-${d}`;
  }
  return null;
}
