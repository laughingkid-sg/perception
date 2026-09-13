import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repositoryRoot, 'dist');
const navigationDirectory = path.join(repositoryRoot, 'navigation');
const applications = [
  'housing-affordability-calculator',
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

for (const application of applications) {
  await requireFile(
    path.join(repositoryRoot, application, 'dist', 'index.html'),
    `Build output for ${application}`,
  );
}

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });
await cp(navigationDirectory, outputDirectory, { recursive: true });

for (const application of applications) {
  await cp(
    path.join(repositoryRoot, application, 'dist'),
    path.join(outputDirectory, application),
    { recursive: true },
  );
}

console.log(`Assembled ${applications.length} applications in ${path.relative(repositoryRoot, outputDirectory)}/`);
