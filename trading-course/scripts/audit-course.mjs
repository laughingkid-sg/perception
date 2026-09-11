import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const courseRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(courseRoot, 'index.html'), 'utf8');
const dataMatch = html.match(
  /<script type="application\/json" id="course-data">([\s\S]*?)<\/script>/,
);
if (!dataMatch) throw new Error('Embedded course data was not found.');

const require = createRequire(import.meta.url);
const CourseUI = require(path.join(courseRoot, 'course-ui.js'));
const pages = CourseUI.preparePages(JSON.parse(dataMatch[1]));
const byId = new Map(pages.map((page) => [page.id, page]));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countItems(fragment) {
  return [...fragment.matchAll(/<li>/g)].length;
}

function orderedListAfter(page, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = page.html.match(
    new RegExp(`<h2>${escaped}<\\/h2>[\\s\\S]*?<ol>([\\s\\S]*?)<\\/ol>`),
  );
  assert(match, `${page.id} is missing ${heading}.`);
  return match[1];
}

assert(pages.length === 61, `Expected 61 pages; found ${pages.length}.`);
assert(byId.size === pages.length, 'Page IDs must be unique.');

const expectedKinds = {
  home: 1,
  week: 6,
  lesson: 30,
  library: 3,
  reference: 13,
  answer: 8,
};
for (const [kind, count] of Object.entries(expectedKinds)) {
  const actual = pages.filter((page) => page.kind === kind).length;
  assert(actual === count, `Expected ${count} ${kind} pages; found ${actual}.`);
}

for (const page of pages) {
  if (page.parent_id !== null) {
    assert(byId.has(page.parent_id), `${page.id} has an unknown parent.`);
  }
}

const requiredLessonSections = [
  'Learning outcomes',
  'Teaching notes',
  'Worked example',
  'Practice',
  'Knowledge check',
  'Completion evidence',
  'References',
];
let lessonQuestionCount = 0;
for (let lessonNumber = 1; lessonNumber <= 30; lessonNumber += 1) {
  const id = `lesson-${String(lessonNumber).padStart(2, '0')}`;
  const lesson = byId.get(id);
  assert(lesson, `Missing ${id}.`);
  assert(lesson.lesson === lessonNumber, `${id} has an incorrect lesson number.`);
  const expectedParent = `week-${String(Math.ceil(lessonNumber / 5)).padStart(2, '0')}`;
  assert(lesson.parent_id === expectedParent, `${id} belongs to the wrong week.`);
  for (const section of requiredLessonSections) {
    assert(lesson.html.includes(`<h2>${section}</h2>`), `${id} is missing ${section}.`);
  }
  const questionCount = countItems(orderedListAfter(lesson, 'Knowledge check'));
  assert(questionCount === 3, `${id} must contain exactly three knowledge checks.`);
  lessonQuestionCount += questionCount;
}

let weeklyQuestionCount = 0;
for (let weekNumber = 1; weekNumber <= 6; weekNumber += 1) {
  const week = byId.get(`week-${String(weekNumber).padStart(2, '0')}`);
  const questionCount = countItems(orderedListAfter(week, 'Checkpoint'));
  assert(questionCount === 5, `${week.id} must contain exactly five checkpoint questions.`);
  weeklyQuestionCount += questionCount;
}

const capstone = byId.get('assessments-capstone');
const capstoneQuestionCount = [
  ...capstone.html.matchAll(/<h2>(?:[1-9]|10)\. /g),
].length;
assert(capstoneQuestionCount === 10, 'The capstone must contain exactly ten questions.');

for (const page of pages) {
  for (const match of page.html.matchAll(/href="#page=([^"&]+)(?:&[^"#]*)?"/g)) {
    assert(byId.has(match[1]), `${page.id} links to unknown page ${match[1]}.`);
  }
}

const sourcePage = byId.get('resources-sources');
const definedSources = new Set(
  [...sourcePage.html.matchAll(/<h2>S(\d{2}) —/g)].map((match) => match[1]),
);
assert(definedSources.size === 15, `Expected 15 evidence sources; found ${definedSources.size}.`);
for (let sourceNumber = 1; sourceNumber <= 15; sourceNumber += 1) {
  assert(
    definedSources.has(String(sourceNumber).padStart(2, '0')),
    `Source S${String(sourceNumber).padStart(2, '0')} is missing.`,
  );
}
for (const page of pages) {
  if (page.id === 'resources-sources') continue;
  for (const match of page.html.matchAll(/\[S(\d{2})\]|<strong>S(\d{2}):/g)) {
    const sourceId = match[1] || match[2];
    assert(definedSources.has(sourceId), `${page.id} cites undefined source S${sourceId}.`);
  }
}

const combinedText = pages.map((page) => page.html).join('\n');
for (const stale of [
  /lark-cli/i,
  /synchronize with Lark/i,
  /Publication and workspace status/i,
  /From the workspace root:/i,
  /\bTODO\b/i,
  /\bTBD\b/i,
]) {
  assert(!stale.test(combinedText), `Stale or unfinished text matched ${stale}.`);
}

const expectedCharts = [
  'lesson-03',
  'lesson-06',
  'lesson-07',
  'lesson-12',
  'lesson-13',
  'lesson-18',
  'lesson-21',
];
assert(
  JSON.stringify(CourseUI.chartPageIds) === JSON.stringify(expectedCharts),
  'The teaching-chart registry is incomplete.',
);
for (const id of CourseUI.chartPageIds) {
  assert(byId.get(id)?.kind === 'lesson', `Chart target ${id} is not a lesson.`);
}

for (const relativePath of [
  'course-ui.css',
  'course-ui.js',
  'resources/sample-trades.json',
  'tools/trading_math.py',
  'tests/test_trading_math.py',
]) {
  assert(fs.existsSync(path.join(courseRoot, relativePath)), `Missing ${relativePath}.`);
}

const totalQuestions = lessonQuestionCount + weeklyQuestionCount + capstoneQuestionCount;
console.log(
  `Course audit passed: ${pages.length} pages, 30 lessons, ${totalQuestions} questions, ${definedSources.size} sources, ${CourseUI.chartPageIds.length} diagrams.`,
);
