import './style.css';
import { browser } from 'wxt/browser';
import { extractPatterns, type Preset } from '../../src/core/patterns';
import { formatMatches, type ExportFormat } from '../../src/core/exports';

const MAX_PAGE_CHARACTERS = 250_000;
const SCAN_TIMEOUT_MS = 15_000;
declare const __WPE_E2E__: boolean;

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId = 0;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('Scan timed out')), timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// This injected function MUST be self-contained. Chrome serializes it into the webpage.
function readTabText(preferSelection: boolean, maxChars: number) {
  const selection = window.getSelection()?.toString() ?? '';
  const selected = preferSelection && selection.trim().length > 0;
  const raw = selected ? selection : (document.body?.innerText ?? '');
  return {
    text: raw.slice(0, maxChars),
    truncated: raw.length > maxChars,
    mode: selected ? 'selection' : 'page',
  };
}

const form = document.querySelector<HTMLFormElement>('#scanForm')!;
const select = document.querySelector<HTMLSelectElement>('#preset')!;
const formatSelect = document.querySelector<HTMLSelectElement>('#format')!;
const useSelection = document.querySelector<HTMLInputElement>('#useSelection')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const count = document.querySelector<HTMLSpanElement>('#count')!;
const preview = document.querySelector<HTMLTextAreaElement>('#matches')!;
const copy = document.querySelector<HTMLButtonElement>('#copy')!;
const download = document.querySelector<HTMLButtonElement>('#download')!;
const scan = document.querySelector<HTMLButtonElement>('#scan')!;

let matches: string[] = [];

function setStatus(message: string) { status.textContent = message; }

function scanErrorMessage(error: unknown): string {
  return error instanceof Error
    ? 'Chrome can’t access this page. Try a regular webpage and scan again.'
    : 'Could not scan this page. Try a regular webpage and scan again.';
}
function updateMatches(next: string[]) {
  matches = next;
  preview.value = next.join('\n');
  count.textContent = `${next.length} found`;
  copy.disabled = next.length === 0;
  download.disabled = next.length === 0;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  scan.disabled = true;
  updateMatches([]);
  setStatus('Scanning...');

  try {
    let [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (__WPE_E2E__ && tab?.url?.startsWith('chrome-extension://')) {
      const tabs = await browser.tabs.query({});
      tab = tabs
        .filter((candidate) => !candidate.url?.startsWith('chrome-extension://'))
        .sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))[0];
    }
    if (tab?.id == null) throw new Error('No active webpage was found.');
    const [result] = await withTimeout(browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: readTabText,
      args: [useSelection.checked, MAX_PAGE_CHARACTERS],
    }), SCAN_TIMEOUT_MS);
    if (!result?.result) throw new Error('No text was returned from this tab.');
    const content = result.result;
    const extracted = extractPatterns(content.text, select.value as Preset);
    updateMatches(extracted.matches);
    const limits = [content.truncated ? 'text scan capped' : '', extracted.truncated ? 'match list capped' : ''].filter(Boolean);
    setStatus(`${content.mode === 'selection' ? 'Selection' : 'Page'} scanned${limits.length ? ` (${limits.join(', ')})` : ''}.`);
  } catch (error) {
    setStatus(scanErrorMessage(error));
  } finally {
    scan.disabled = false;
  }
});

copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(formatMatches(matches, formatSelect.value as ExportFormat));
    setStatus('Copied to clipboard.');
  } catch {
    setStatus('Clipboard access failed. Try Download instead.');
  }
});

download.addEventListener('click', () => {
  if (!matches.length) return;
  const format = formatSelect.value as ExportFormat;
  const mime = format === 'json' ? 'application/json' : 'text/plain';
  const blob = new Blob([formatMatches(matches, format)], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `web-patterns.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  setStatus('File download started.');
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
});
