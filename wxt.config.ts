import { defineConfig } from 'wxt';

const e2e = process.env.WPE_E2E === '1';

export default defineConfig({
  outDir: e2e ? '.output-e2e' : '.output',
  vite: () => ({
    define: {
      __WPE_E2E__: JSON.stringify(e2e),
    },
  }),
  manifest: {
    name: 'Web Pattern Extractor',
    description: 'Extract useful patterns from webpage text, then copy or export locally.',
    permissions: ['activeTab', 'scripting'],
    ...(e2e ? { host_permissions: ['http://127.0.0.1/*'] } : {}),
    homepage_url: 'https://faisalhafeez.com',
  },
});
