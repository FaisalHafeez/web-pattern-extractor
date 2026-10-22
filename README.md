# Web Pattern Extractor

A small, local-first Chrome extension for extracting email addresses, web URLs, ISO-style dates, and hex colors from selected text or visible webpage text. Review the matches, then copy them or export TXT, CSV, or JSON.

Built with WXT, TypeScript, and vanilla HTML/CSS. It complements [Web Table Exporter](https://github.com/FaisalHafeez/web-table-exporter): use that for structured HTML tables and this extension for patterns in ordinary text.

## Use it

1. Open a webpage and select text if you want to scan only that selection.
2. Click the Web Pattern Extractor toolbar button.
3. Choose a pattern and select **Scan current page**.
4. Review the deduplicated matches, choose an export format, then copy or download.

The built-in patterns are email addresses, `http` and `https` URLs found in text, `YYYY-MM-DD` date-shaped strings, and three- or six-digit hex colors. For example, a scan of `docs@example.org · https://example.org/docs · 2026-10-22 · #2A61D8` can find each value with its corresponding preset.

## Install from GitHub

This project is distributed as source and a compiled extension ZIP through GitHub Releases. It is not published in the Chrome Web Store.

1. Download the ZIP attached to the latest [GitHub Release](https://github.com/FaisalHafeez/web-pattern-extractor/releases).
2. Extract the ZIP into a folder that you will keep on your computer.
3. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
4. Select the extracted extension folder.

To load an unpacked development build, use the `.output/chrome-mv3/` folder after running the build steps below.

## Privacy and permissions

The extension has no account, backend, analytics, or remote API. It asks for Chrome’s `activeTab` and `scripting` permissions. It reads selected text when available, otherwise visible text from the current tab, only after you click **Scan current page**. Results stay in the popup unless you choose to copy or download them.

Avoid scanning sensitive pages or sharing extracted personal information without authorization. The extension does not monitor tabs or scan sites in the background.

## Limits

- A scan reads at most 250,000 characters and returns at most 500 unique matches. The popup reports when either limit truncates results.
- Detection is pattern-based. An ISO date-shaped value or email-like string may not be a valid real-world value.
- Text in iframes, shadow DOM, PDFs, virtualized lists, or other browser-restricted areas may be missing.
- Chrome internal pages and other pages that deny extension access cannot be scanned.
- URL detection looks for visible `http` and `https` text. It does not extract link destinations that are hidden behind anchor text.
- CSV output quotes values and prefixes formula-like values to reduce spreadsheet formula execution risk.

## Build and verify

Requirements: [Bun](https://bun.sh/) 1.4.3 and a Chromium browser installed by Playwright for the end-to-end suite.

```sh
bun install --frozen-lockfile
bun run test
bun run typecheck
bun run build
bun run zip
bun run test:e2e
```

WXT writes the unpacked production extension to `.output/chrome-mv3/` and the ZIP to `.output/`. The E2E suite builds a separate unpacked test copy in `.output-e2e/` and launches it in a persistent Playwright Chromium profile with a test-only localhost permission. The production build retains only `activeTab` and `scripting` permissions and no host permissions.

## Project

- **Author:** [Faisal Hafeez](https://faisalhafeez.com)
- **License:** MIT
- **Stack:** WXT, TypeScript, Manifest V3, vanilla HTML/CSS

Contributions and focused bug reports are welcome. Keep the extension local-first and manual, with no backend or background collection.
