import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repositoryRoot, 'dist');
const applications = [
  'compound-interest-calculator',
  'housing-affordability-calculator',
  'krisflyer-spontaneous-escapes',
  'trading-course',
  'us-compensation-compare',
];

async function requirePath(target, description) {
  try {
    await access(target);
  } catch {
    throw new Error(`${description} is missing: ${path.relative(repositoryRoot, target)}`);
  }
}

async function verifyLocalReferences(htmlPath) {
  const html = await readFile(htmlPath, 'utf8');
  const references = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map(
    ([, reference]) => reference,
  );

  for (const reference of references) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(reference)) continue;

    const pathname = reference.split(/[?#]/, 1)[0];
    if (!pathname || pathname === './') continue;

    const target = path.resolve(path.dirname(htmlPath), pathname);
    if (!target.startsWith(`${outputDirectory}${path.sep}`)) {
      throw new Error(`Reference leaves the deployment bundle: ${reference}`);
    }

    await requirePath(target, `Local reference from ${path.relative(outputDirectory, htmlPath)}`);
  }
}

const navigationPath = path.join(outputDirectory, 'index.html');
const navigationHtml = await readFile(navigationPath, 'utf8');
const appNavigationPath = path.join(outputDirectory, '_shared', 'app-navigation.js');

await requirePath(appNavigationPath, 'Shared application navigation bundle');

if (!navigationHtml.includes('<h1 id="page-title">Just Kudos Things</h1>')) {
  throw new Error('Navigation heading is missing or outdated.');
}

for (const application of applications) {
  const expectedLink = `href="./${application}/"`;
  if (!navigationHtml.includes(expectedLink)) {
    throw new Error(`Navigation link is missing: ${expectedLink}`);
  }

  const applicationIndex = path.join(outputDirectory, application, 'index.html');
  const applicationHtml = await readFile(applicationIndex, 'utf8');
  if (!applicationHtml.includes('data-perception-navigation-script')) {
    throw new Error(`Shared navigation was not injected into ${application}.`);
  }

  await verifyLocalReferences(applicationIndex);
}

await verifyLocalReferences(navigationPath);
console.log(`Verified navigation and local assets for ${applications.length} applications.`);
