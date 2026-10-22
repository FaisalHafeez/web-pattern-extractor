import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const extensionPath = resolve('.output-e2e/chrome-mv3');
const fixture = await readFile('tests/fixture.html', 'utf8');
let pageMarkup = fixture;
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(pageMarkup);
});
await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
assert(address && typeof address !== 'string');
const fixtureUrl = `http://127.0.0.1:${address.port}/`;
const deniedUrl = `http://localhost:${address.port}/`;
const userDataDir = await mkdtemp(join(tmpdir(), 'web-pattern-extractor-'));
const downloadDir = await mkdtemp(join(tmpdir(), 'web-pattern-downloads-'));
const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  acceptDownloads: true,
  downloadsPath: downloadDir,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});

try {
  const hostPage = context.pages()[0] ?? await context.newPage();
  await hostPage.goto(fixtureUrl);
  const extensionsPage = await context.newPage();
  await extensionsPage.goto('chrome://extensions');
  const extensionId = await extensionsPage.evaluate(() => {
    const ids: string[] = [];
    const visit = (root: Document | ShadowRoot) => {
      for (const element of root.querySelectorAll('*')) {
        const id = element.getAttribute('id') ?? '';
        if (/^[a-p]{32}$/.test(id)) ids.push(id);
        if (element.shadowRoot) visit(element.shadowRoot);
      }
    };
    visit(document);
    return ids[0] ?? null;
  });
  assert(extensionId, 'The built extension should appear in chrome://extensions');
  await extensionsPage.close();

  const popup = await context.newPage();
  if (process.env.CI) {
    // Xvfb has no system clipboard. Keep the extension's Clipboard API boundary deterministic in CI.
    await popup.addInitScript(() => {
      let copiedText = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => { copiedText = text; },
          readText: async () => copiedText,
        },
      });
    });
  }
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const scan = async (label: string) => {
    console.log(`E2E scan: ${label}`);
    await popup.bringToFront();
    await popup.getByRole('button', { name: 'Scan current page' }).click();
    try {
      await popup.waitForFunction(
        () => !document.querySelector<HTMLButtonElement>('#scan')?.disabled,
        undefined,
        { timeout: 20_000 },
      );
    } catch {
      throw new Error(`Scan did not finish (${label}); status: ${await popup.locator('#status').innerText()}`);
    }
  };

  await scan('page email extraction');
  assert.equal(await popup.locator('#matches').inputValue(), 'docs@example.org\nops@example.org\nselected@example.net');
  assert.match(await popup.locator('#status').innerText(), /Page scanned/);

  await popup.locator('#useSelection').uncheck();
  await popup.locator('#preset').selectOption('url');
  await scan('page URL extraction');
  assert.equal(await popup.locator('#matches').inputValue(), 'https://example.org/docs\nhttps://selected.example/path');

  await popup.locator('#preset').selectOption('iso-date');
  await scan('ISO date extraction');
  assert.equal(await popup.locator('#matches').inputValue(), '2026-10-22');
  await popup.locator('#preset').selectOption('hex-color');
  await scan('hex color extraction');
  assert.equal(await popup.locator('#matches').inputValue(), '#2A61D8');

  await hostPage.evaluate(() => {
    const selection = window.getSelection();
    const textNode = document.querySelector('main p:last-child')?.firstChild;
    if (!selection || !textNode) throw new Error('Selection fixture was not found');
    const start = textNode.textContent!.indexOf('selected@example.net');
    const end = textNode.textContent!.indexOf('selected.example/path') + 'selected.example/path'.length;
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await popup.locator('#useSelection').check();
  await popup.locator('#preset').selectOption('email');
  await scan('selected text extraction');
  assert.equal(await popup.locator('#matches').inputValue(), 'selected@example.net');
  assert.match(await popup.locator('#status').innerText(), /Selection scanned/);

  await popup.locator('#format').selectOption('json');
  await popup.getByRole('button', { name: 'Copy' }).click();
  assert.equal(await popup.evaluate(() => navigator.clipboard.readText()), '[\n  "selected@example.net"\n]\n');
  assert.match(await popup.locator('#status').innerText(), /Copied to clipboard/);

  await popup.locator('#format').selectOption('csv');
  const downloadEvent = popup.waitForEvent('download');
  await popup.getByRole('button', { name: 'Download' }).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'web-patterns.csv');
  const downloadedPath = join(downloadDir, download.suggestedFilename());
  await download.saveAs(downloadedPath);
  assert.equal(await readFile(downloadedPath, 'utf8'), 'value\r\n"selected@example.net"\r\n');

  pageMarkup = '<!doctype html><html><body><p>No matching values.</p></body></html>';
  await hostPage.goto(fixtureUrl);
  await popup.locator('#preset').selectOption('email');
  await scan('empty state');
  assert.equal(await popup.locator('#matches').inputValue(), '');
  assert.equal(await popup.locator('#copy').isDisabled(), true);
  assert.equal(await popup.locator('#download').isDisabled(), true);
  assert.match(await popup.locator('#count').innerText(), /0 found/);

  await hostPage.goto('chrome://version');
  await scan('unsupported browser page');
  assert.match(await popup.locator('#status').innerText(), /can.t access this page/i);

  pageMarkup = fixture;
  await hostPage.goto(deniedUrl);
  await scan('denied host permission');
  assert.match(await popup.locator('#status').innerText(), /can.t access this page/i);

  pageMarkup = `<html><body><p>${'x'.repeat(250_001)} capped@example.org</p></body></html>`;
  await hostPage.goto(fixtureUrl);
  await scan('source text truncation');
  assert.equal(await popup.locator('#matches').inputValue(), '');
  assert.match(await popup.locator('#status').innerText(), /text scan capped/);

  pageMarkup = `<html><body><p>${Array.from({ length: 501 }, (_, index) => `person${index}@example.org`).join(' ')}</p></body></html>`;
  await hostPage.goto(fixtureUrl);
  await scan('match count truncation');
  assert.equal((await popup.locator('#matches').inputValue()).split('\n').length, 500);
  assert.match(await popup.locator('#status').innerText(), /match list capped/);

  console.log('Chromium extension E2E passed: page and selection scans, four presets, clipboard, CSV download, empty state, unsupported page, and denied page access.');
} finally {
  await context.close();
  server.close();
  await Promise.all([
    rm(userDataDir, { recursive: true, force: true }),
    rm(downloadDir, { recursive: true, force: true }),
  ]);
}
