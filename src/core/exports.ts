export type ExportFormat = 'txt' | 'csv' | 'json';

function csvCell(value: string): string {
  // Guard spreadsheet formula execution when a CSV is opened in spreadsheet software.
  const guarded = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${guarded.replaceAll('"', '""')}"`;
}

export function formatMatches(matches: string[], format: ExportFormat): string {
  if (format === 'json') return JSON.stringify(matches, null, 2) + '\n';
  if (format === 'csv') return ['value', ...matches.map(csvCell)].join('\r\n') + '\r\n';
  return matches.join('\n') + (matches.length ? '\n' : '');
}
