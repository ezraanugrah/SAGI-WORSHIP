// Downloads every chapter page of the given Alkitab Mobile SABDA versions
// (the source used by alkitab-api-master) into .cache/sabda/<version>/.
// Pages already in the cache are skipped, so the script can be re-run.
//
//   node scripts/scripture/fetch-sabda.mjs av
//
// Requests go out one at a time with a short pause to stay polite.
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname } from "node:path";
import { BOOKS } from "./books.mjs";
import { cachePath } from "./sabda.mjs";

const versions = process.argv.slice(2);
if (!versions.length) {
  console.error("Usage: node scripts/scripture/fetch-sabda.mjs <version...>");
  process.exit(1);
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

async function fetchChapter(version, book, chapter) {
  const url = `https://alkitab.mobi/${version}/${book.sabda}/${chapter}/`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "SagiWorship-dataset-builder" },
        signal: AbortSignal.timeout(30000),
      });
      const html = await response.text();
      if (response.ok && html.includes('class="reftext"')) return html;
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 5) throw new Error(`${url}: ${error.message}`);
      await pause(2000 * attempt);
    }
  }
}

let done = 0,
  fetched = 0;
const total =
  versions.length * BOOKS.reduce((sum, book) => sum + book.chapters, 0);
for (const version of versions)
  for (const book of BOOKS)
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      const path = cachePath(version, book, chapter);
      if (!(await exists(path))) {
        const html = await fetchChapter(version, book, chapter);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, html);
        fetched++;
        await pause(250);
      }
      if (++done % 100 === 0 || done === total)
        console.log(`${done}/${total} (${fetched} downloaded)`);
    }
