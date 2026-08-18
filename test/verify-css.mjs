/* Classes referenced by the app that have no rule in styles.css.
   Compares against the v1-legacy stylesheet to recover anything the prune ate. */
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
const css = fs.readFileSync(repo + 'css/styles.css', 'utf8');
const code = ['index.html','js/app.js','js/venue.js','js/data.js','js/story.js']
  .map(f => fs.readFileSync(repo + f, 'utf8')).join('\n');
const legacy = execSync('git show v1-legacy:index.html', { cwd: repo, maxBuffer: 1e8 }).toString();

// class names appearing in class="..." attributes in the app code
const used = new Set();
for (const m of code.matchAll(/class="([^"]*)"/g)) {
  m[1].split(/[\s$]+/).forEach(c => {
    const clean = c.replace(/\$\{.*/, '').trim();
    if (clean && /^[a-zA-Z][\w-]*$/.test(clean)) used.add(clean);
  });
}
const hasRule = c => new RegExp(`\\.${c}\\b`).test(css);
const inLegacy = c => new RegExp(`\\.${c}\\b`).test(legacy);

const missing = [...used].filter(c => !hasRule(c)).sort();
const recoverable = missing.filter(inLegacy);
console.log('classes used by app:', used.size);
console.log('missing a CSS rule:', missing.length);
console.log('\n-- had a rule in v1-legacy (regression, must restore) --');
recoverable.forEach(c => {
  const rules = [...legacy.matchAll(new RegExp(`^\\s*\\.${c}\\b[^\\n]*$`, 'gm'))].map(x => x[0].trim());
  console.log(`\n${c}:`);
  rules.forEach(r => console.log('  ' + r));
});
console.log('\n-- never styled (fine) --');
console.log(missing.filter(c => !inLegacy(c)).join(', ') || '(none)');

const broken = missing.filter(inLegacy);
if (broken.length) {
  console.error(`\nFAIL: ${broken.length} class(es) lost their styling: ${broken.join(', ')}`);
  process.exit(1);
}
console.log('\nOK: every class the app uses either has a rule or never had one.');
