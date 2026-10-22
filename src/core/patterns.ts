export type Preset = 'email' | 'url' | 'iso-date' | 'hex-color';

export interface ExtractionResult {
  preset: Preset;
  matches: string[];
  truncated: boolean;
}

const MAX_RESULTS = 500;

const rules: Record<Preset, RegExp> = {
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  url: /https?:\/\/[^\s<>"'`]+/gi,
  'iso-date': /\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g,
  'hex-color': /#[A-F0-9]{6}\b|#[A-F0-9]{3}\b/gi,
};

function normalize(candidate: string, preset: Preset): string {
  if (preset === 'url') return candidate.replace(/[),;.!?\]}]+$/, '');
  return candidate;
}

function uniqueKey(candidate: string, preset: Preset): string {
  return preset === 'email' || preset === 'hex-color'
    ? candidate.toLowerCase()
    : candidate;
}

export function extractPatterns(text: string, preset: Preset): ExtractionResult {
  const regex = new RegExp(rules[preset].source, rules[preset].flags);
  const seen = new Set<string>();
  const matches: string[] = [];
  let truncated = false;

  for (const match of text.matchAll(regex)) {
    const value = normalize(match[0], preset);
    if (!value) continue;
    const key = uniqueKey(value, preset);
    if (seen.has(key)) continue;
    seen.add(key);
    if (matches.length >= MAX_RESULTS) {
      truncated = true;
      break;
    }
    matches.push(value);
  }

  return { preset, matches, truncated };
}
