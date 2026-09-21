import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repositoryRoot, 'dist');
const navigationDirectory = path.join(repositoryRoot, 'navigation');
const appNavigationDirectory = path.join(repositoryRoot, 'app-navigation', 'dist');
const applications = [
  'compound-interest-calculator',
  'housing-affordability-calculator',
  'krisflyer-spontaneous-escapes',
  'trading-course',
  'us-compensation-compare',
];

async function requireFile(filePath, description) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${description} is missing: ${path.relative(repositoryRoot, filePath)}`);
  }
}

await requireFile(path.join(navigationDirectory, 'index.html'), 'Navigation page');
await requireFile(
  path.join(appNavigationDirectory, 'app-navigation.js'),
  'Shared application navigation bundle',
);

for (const application of applications) {
  await requireFile(
    path.join(repositoryRoot, application, 'dist', 'index.html'),
    `Build output for ${application}`,
  );
}

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });
await cp(navigationDirectory, outputDirectory, { recursive: true });
await cp(appNavigationDirectory, path.join(outputDirectory, '_shared'), { recursive: true });

async function injectApplicationNavigation(htmlPath) {
  const html = await readFile(htmlPath, 'utf8');
  const launcher = [
    '    <script',
    '      type="module"',
    '      src="../_shared/app-navigation.js"',
    '      data-perception-navigation-script',
    '      data-site-root="../"',
    '    ></script>',
  ].join('\n');

  if (!html.includes('</body>')) {
    throw new Error(`Cannot inject application navigation: ${path.relative(repositoryRoot, htmlPath)}`);
  }

  await writeFile(htmlPath, html.replace('</body>', `${launcher}\n  </body>`));
}

for (const application of applications) {
  await cp(
    path.join(repositoryRoot, application, 'dist'),
    path.join(outputDirectory, application),
    { recursive: true },
  );
  await injectApplicationNavigation(path.join(outputDirectory, application, 'index.html'));
}

console.log(`Assembled ${applications.length} applications in ${path.relative(repositoryRoot, outputDirectory)}/`);
