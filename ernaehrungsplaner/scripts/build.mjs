// Baut die App zu einem Artefakt-Fragment (dist/artifact.html) und einer lokal
// öffnenbaren Vorschau (dist/preview.html, React lokal eingebettet, ohne Netzwerk).
import { build, context, transform } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');
mkdirSync('dist', { recursive: true });

// React kommt im Artefakt per CDN (UMD-Globals), deshalb nur Verweise bündeln.
const globals = {
  name: 'react-globals',
  setup(b) {
    b.onResolve({ filter: /^react(-dom)?(\/client)?$/ }, (args) => ({ path: args.path, namespace: 'g' }));
    b.onLoad({ filter: /.*/, namespace: 'g' }, (args) => ({
      contents: `module.exports = window.${args.path.startsWith('react-dom') ? 'ReactDOM' : 'React'};`,
      loader: 'js',
    }));
  },
};

const TITLE = 'Wochentisch Ernährungsplaner';
const DESC = 'Interaktiver Ernährungs- und Wochenplaner mit Rezepten, automatischer Einkaufsliste und Vorratsverwaltung';
const FONTS = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=IBM+Plex+Mono:wght@400;500;600&display=swap';
const REACT = 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js';
const REACT_DOM = 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js';

const options = {
  entryPoints: ['src/main.tsx'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  write: false,
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  legalComments: 'none',
  plugins: [globals],
  logLevel: 'warning',
};

async function emit(result) {
  const js = result.outputFiles[0].text;
  if (/<\/script/i.test(js)) throw new Error('Bundle enthält "</script" – kann nicht inline eingebettet werden.');
  const css = (await transform(readFileSync('src/styles.css', 'utf8'), { loader: 'css', minify: true })).code;
  const head = [
    `<title>${TITLE}</title>`,
    '<meta name="claude:viewport-fit-sides" content="cover">',
    `<meta name="description" content="${DESC}">`,
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link rel="stylesheet" href="${FONTS}">`,
    `<style>${css}</style>`,
  ].join('\n');
  const body = '<div id="root"></div>';
  const artifact = [head, body, `<script src="${REACT}"></script>`, `<script src="${REACT_DOM}"></script>`, `<script>${js}</script>`].join('\n');
  writeFileSync('dist/artifact.html', artifact + '\n');

  const reactLocal = readFileSync('node_modules/react/umd/react.production.min.js', 'utf8');
  const domLocal = readFileSync('node_modules/react-dom/umd/react-dom.production.min.js', 'utf8');
  const preview = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>${head.replace(/<link[^>]+fonts[^>]+>\n?/g, '')}</head><body>${body}<script>${reactLocal}</script><script>${domLocal}</script><script>${js}</script></body></html>`;
  writeFileSync('dist/preview.html', preview);
  console.log(`dist/artifact.html: ${(artifact.length / 1024).toFixed(0)} KiB (JS ${(js.length / 1024).toFixed(0)} KiB, CSS ${(css.length / 1024).toFixed(0)} KiB)`);
}

if (watch) {
  const ctx = await context({ ...options, plugins: [...options.plugins, { name: 'emit', setup(b) { b.onEnd((r) => r.errors.length || emit(r)); } }] });
  await ctx.watch();
  console.log('Beobachte Änderungen …');
} else {
  await emit(await build(options));
}
