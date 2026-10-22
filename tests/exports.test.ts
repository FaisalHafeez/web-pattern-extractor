import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { formatMatches } from '../src/core/exports.ts';

test('TXT is newline separated', () => {
  assert.equal(formatMatches(['one', 'two'], 'txt'), 'one\ntwo\n');
});
test('JSON is a valid array', () => {
  assert.deepEqual(JSON.parse(formatMatches(['a', 'b'], 'json')), ['a', 'b']);
});
test('CSV escapes quotes and potentially executable spreadsheet formulas', () => {
  const expected = `value\r\n"hello""world"\r\n"'=1+1"\r\n"'  @foo"\r\n`;
  assert.equal(formatMatches(['hello"world', '=1+1', '  @foo'], 'csv'), expected);
});
