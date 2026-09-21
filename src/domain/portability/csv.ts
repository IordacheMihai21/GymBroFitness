/** RFC4180-compatible reader adapted from the behavior documented by
 * gossamr/swift-workout-importer (MIT), implemented independently in TypeScript. */
export function parseCsv(raw: string): string[][] {
  const input = raw.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function csvRecords(raw: string): Record<string, string>[] {
  const rows = parseCsv(raw);
  const headers = rows[0]?.map((header) => header.trim()) ?? [];
  if (headers.length === 0) throw new Error('CSV has no header row.');
  return rows
    .slice(1)
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ''])),
    );
}
