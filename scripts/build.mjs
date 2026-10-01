import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const outputDirectory = new URL('../dist/', import.meta.url);
const projectRoot = new URL('../', import.meta.url);
const publicFiles = [
    'index.html',
    'style.css',
    'script.js',
    'site.webmanifest',
    'robots.txt',
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of publicFiles) {
    await cp(new URL(file, projectRoot), new URL(file, outputDirectory));
}

await cp(new URL('assets/', projectRoot), new URL('assets/', outputDirectory), { recursive: true });
await writeFile(new URL('.nojekyll', outputDirectory), '');

console.log(`Built ${publicFiles.length + 2} release entries in dist/.`);
