// Formt den Einzeldatei-Build (dist-single/index.html) in ein Seitenfragment um:
// <title>, <style> und Skripte bleiben erhalten, das Dokumentgerüst (doctype/html/head/body) entfällt.
import { readFileSync, writeFileSync } from 'node:fs';

const [src = 'dist-single/index.html', out = 'dist-single/artifact.html'] = process.argv.slice(2);
const html = readFileSync(src, 'utf8');
const title = (html.match(/<title>[\s\S]*?<\/title>/) ?? ['<title>Automatikgetriebe 3D</title>'])[0];
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]);
const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0].replace(/ crossorigin(="[^"]*")?/, ''));
const description = '<meta name="description" content="Interaktive 3D-Lernsimulation eines Wandlerautomatikgetriebes mit Planetenradsätzen" />';
const body = '<div id="root"></div>';
writeFileSync(out, [title, description, ...styles, body, ...scripts].join('\n'));
console.log(`${out}: ${(readFileSync(out).length / 1024).toFixed(0)} KiB, ${styles.length} style, ${scripts.length} script`);
