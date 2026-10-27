import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Umami page-view analytics: the only third party allowed to run or receive data.
const ANALYTICS = 'https://analytics.echolabs.dev';

// The privacy promise ("your text never leaves your device") is enforced, not
// just stated: connect-src only allows the analytics host, so the page can't
// send anything anywhere else. Images stay open because Markdown can reference
// remote images.
const CSP = [
  "default-src 'self'",
  `script-src 'self' ${ANALYTICS}`,
  "style-src 'self' 'unsafe-inline'",
  'img-src * data: blob:',
  "font-src 'self'",
  `connect-src ${ANALYTICS}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Cloudflare Pages reads dist/_headers. The header form of the policy can also
// forbid framing, which a <meta> CSP cannot.
const HEADERS = `/*
  Content-Security-Policy: ${CSP}; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

/**
 * Build-only: the dev server needs a WebSocket for hot reload. The <meta> copy
 * keeps the policy in force on hosts that ignore _headers (and in `vite preview`).
 */
function securityHeaders(): Plugin {
  return {
    name: 'security-headers',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS });
    },
  };
}

/**
 * Minification strips the copyright headers of bundled dependencies, so ship
 * their license texts alongside the site instead. Every runtime dependency is
 * bundled, so package.json's dependencies is the list.
 */
function thirdPartyLicenses(): Plugin {
  return {
    name: 'third-party-licenses',
    apply: 'build',
    generateBundle() {
      const { dependencies = {} } = JSON.parse(readFileSync('package.json', 'utf8'));
      const sections = Object.keys(dependencies).map((name) => {
        const dir = join('node_modules', name);
        const { version, license } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        const texts = readdirSync(dir)
          .filter((file) => /^(licen[cs]e|copying)/i.test(file))
          .map((file) => readFileSync(join(dir, file), 'utf8').trim());
        if (texts.length === 0) throw new Error(`No license file found for ${name}`);
        return [`${name} ${version} — ${license}`, ...texts].join('\n\n');
      });
      const source = ['Third-party software bundled in this site.', ...sections].join(`\n\n${'='.repeat(72)}\n\n`);
      this.emitFile({ type: 'asset', fileName: 'third-party-licenses.txt', source: source + '\n' });
    },
  };
}

export default defineConfig({
  plugins: [securityHeaders(), thirdPartyLicenses()],
  server: { port: 5179, strictPort: true },
  build: { modulePreload: { polyfill: false } },
});
