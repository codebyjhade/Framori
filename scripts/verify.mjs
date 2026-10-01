import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
const requiredFiles = [
    'index.html',
    'style.css',
    'script.js',
    'assets/favicon.svg',
    'site.webmanifest',
    'vercel.json',
    'README.md',
    'PRIVACY.md',
    'LICENSE',
];

const failures = [];

for (const file of requiredFiles) {
    try {
        await access(new URL(file, projectRoot));
    } catch {
        failures.push(`Missing required file: ${file}`);
    }
}

const html = await readFile(new URL('index.html', projectRoot), 'utf8');
const css = await readFile(new URL('style.css', projectRoot), 'utf8');
const javascript = await readFile(new URL('script.js', projectRoot), 'utf8');
const combined = `${html}\n${css}\n${javascript}`;

for (const legacyName of ['FrameBatch', 'framebatch', 'FRAMEBATCH', 'HD Layout', 'LucasAnd', 'layout-generator']) {
    if (combined.includes(legacyName)) failures.push(`Legacy brand reference remains: ${legacyName}`);
}

for (const requiredText of ['Framori', 'BRYAN JHADE EBUAN', 'assets/favicon.svg', 'site.webmanifest']) {
    if (!html.includes(requiredText)) failures.push(`Required page content is missing: ${requiredText}`);
}

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) failures.push(`Duplicate HTML IDs: ${duplicateIds.join(', ')}`);

const referencedIds = [...javascript.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map(match => match[1]);
const missingIds = [...new Set(referencedIds.filter(id => !ids.includes(id)))];
if (missingIds.length) failures.push(`JavaScript references missing HTML IDs: ${missingIds.join(', ')}`);

const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
const openingBraces = (cssWithoutComments.match(/\{/g) || []).length;
const closingBraces = (cssWithoutComments.match(/\}/g) || []).length;
if (openingBraces !== closingBraces) failures.push(`CSS braces are unbalanced: ${openingBraces} opening, ${closingBraces} closing`);

const scriptPath = fileURLToPath(new URL('script.js', projectRoot));
const syntaxCheck = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
if (syntaxCheck.status !== 0) failures.push(`JavaScript syntax check failed:\n${syntaxCheck.stderr.trim()}`);

if (failures.length) {
    console.error(`Framori verification failed:\n- ${failures.join('\n- ')}`);
    process.exit(1);
}

console.log(`Framori verification passed: ${ids.length} unique HTML IDs and ${requiredFiles.length} required files checked.`);
