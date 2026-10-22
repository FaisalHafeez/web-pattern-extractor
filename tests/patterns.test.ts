import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractPatterns } from '../src/core/patterns.ts';

test('extracts unique emails case insensitively', () => {
  assert.deepEqual(extractPatterns('HI@EXAMPLE.COM hi@example.com foo+bar@example.org', 'email').matches,
    ['HI@EXAMPLE.COM', 'foo+bar@example.org']);
});
test('extracts visible plain-text URLs and strips punctuation', () => {
  assert.deepEqual(extractPatterns('See https://example.com/path, and https://foo.test/docs.', 'url').matches,
    ['https://example.com/path', 'https://foo.test/docs']);
});
test('extracts ISO date-shaped strings', () => {
  assert.deepEqual(extractPatterns('2026-10-22 2026-19-55 2024-02-29', 'iso-date').matches,
    ['2026-10-22', '2024-02-29']);
});
test('extracts hex colors', () => {
  assert.deepEqual(extractPatterns('background:#A1b2C3; color: #fff;', 'hex-color').matches,
    ['#A1b2C3', '#fff']);
});
test('returns empty array for no matches', () => {
  assert.deepEqual(extractPatterns('nothing here', 'email').matches, []);
});
test('deduplicates before enforcing the 500 result limit and reports truncation', () => {
  const input = Array.from({ length: 501 }, (_, index) => `person${index}@example.org`).join(' ');
  const result = extractPatterns(input, 'email');
  assert.equal(result.matches.length, 500);
  assert.equal(result.matches[0], 'person0@example.org');
  assert.equal(result.matches.at(-1), 'person499@example.org');
  assert.equal(result.truncated, true);
});
