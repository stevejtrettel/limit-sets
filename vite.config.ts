import { defineConfig, type PluginOption } from 'vite';
import path from 'path';
import { writeFileSync, mkdirSync } from 'node:fs';

// Dev-only middleware: demos POST their current view JSON (camera + projection
// info + example id + ...) to /__save-view/<group>, which we write to
// outputs/presets/<group>-view-preset.json (gitignored working state — not code,
// grouped with the renders it frames). The render script reads it on startup.
//
// Whitelist of allowed group names keeps this safe — we only ever write into
// outputs/presets/<known-group>-view-preset.json, never an attacker path.
const ALLOWED_GROUPS = new Set(['sp6', 'o5', 'sl2c', 'sl3r', 'sl4r', 'su21', 'james-marit-new', 'schwartz-pappus', 'marked-boxes']);

function viewPresetWriter(): PluginOption {
  return {
    name: 'view-preset-writer',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-view', (req, res, next) => {
        if (req.method !== 'POST') return next();
        // URL is /__save-view/<group> — extract group from the trailing path.
        const url = req.url ?? '';
        const m = /^\/([a-z][a-z0-9_-]{0,31})$/.exec(url);
        const group = m?.[1];
        if (!group || !ALLOWED_GROUPS.has(group)) {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({
            ok: false,
            error: `unknown group '${group ?? ''}'. POST to /__save-view/<group> where group is one of ${[...ALLOWED_GROUPS].join(', ')}`,
          }));
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            JSON.parse(body);
            const file = `outputs/presets/${group}-view-preset.json`;
            const out = path.resolve(__dirname, file);
            mkdirSync(path.dirname(out), { recursive: true });
            writeFileSync(out, body);
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: file }));
          } catch (e) {
            res.statusCode = 400;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: '[name].js',
        assetFileNames: 'index.[ext]',
      },
    },
  },
  plugins: [viewPresetWriter()],
});
