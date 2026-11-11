// Reads chapter pages cached by fetch-sabda.mjs. The parsing follows
// alkitab-api-master's getChapters: each <p> with a .reftext number is a
// verse, .paragraphtitle paragraphs are section headings (not verse text).
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", ".cache", "sabda");

export const cachePath = (version, book, chapter) =>
  join(root, version, book.sabda, `${chapter}.html`);

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === "#")
      return String.fromCodePoint(
        name[1].toLowerCase() === "x"
          ? parseInt(name.slice(2), 16)
          : parseInt(name.slice(1), 10),
      );
    return entities[name.toLowerCase()] ?? whole;
  });
}
// SABDA writes Psalm titles and similar notes as literal "<<…>>" inside the
// HTML; turn them into «…» first so stripping tags cannot swallow them.
const plain = (html) =>
  decode(html.replace(/<<([^<>]*)>>/g, "«$1»").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();

/**
 * Returns [{verse, text}] in page order. A paragraph without a verse number
 * continues the verse before it (TB prints e.g. "(35-22b) …" as its own
 * paragraph); those are listed in `joined`, anything before verse 1 in `extra`.
 */
export async function readChapter(version, book, chapter) {
  const html = await readFile(cachePath(version, book, chapter), "utf8");
  const start = html.indexOf("<hr/>\n<div>"),
    end = html.indexOf('<div class="share"');
  if (start < 0 || end < start)
    throw new Error(`${version} ${book.sabda} ${chapter}: unexpected page layout`);
  const verses = [],
    joined = [],
    extra = [];
  for (const [, body] of html
    .slice(start, end)
    .matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    if (body.includes("paragraphtitle")) continue;
    const number = body.match(/class="reftext"[^>]*>\s*<a[^>]*>(\d+)<\/a>/);
    const text = plain(body.replace(/<span class="reftext">[\s\S]*?<\/span>/, ""));
    if (number) verses.push({ verse: Number(number[1]), text });
    else if (text && verses.length) {
      verses.at(-1).text += ` ${text}`;
      joined.push(`${verses.at(-1).verse}: ${text}`);
    } else if (text) extra.push(text);
  }
  return { verses, joined, extra };
}
