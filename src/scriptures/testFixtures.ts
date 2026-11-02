/** Original synthetic text, imported only by tests. No Bible translation is bundled. */
import { canonicalJSON, parseDataset, sha256, unsigned } from "./importFormat";
import type { Dataset, PreparedDataset } from "./models";
export function fixtureDataset(): Dataset {
  return {
    format: "sagi-scripture",
    version: 1,
    translation: {
      publisher: "Synthetic Test Publisher",
      code: "SYN",
      name: "Synthetic Test Edition",
      abbreviation: "SYN",
      edition: "1.0",
      language: "en",
      versification: "synthetic-fixture-v1",
      coverage: "partial",
      source: "Original software test fixture; not a Bible translation",
      license: {
        kind: "permission",
        notice: "Synthetic test text created solely for software verification.",
        reference: "Synthetic fixture grant",
        displayAttribution: "SYN — Original synthetic test text",
        permissions: {
          offlineStorage: true,
          projection: true,
          localSnapshots: true,
          export: false,
        },
      },
    },
    books: [
      {
        id: "John",
        name: "John",
        aliases: ["Jn", "Yohanes"],
        order: 1,
        chapters: [
          { number: 3, verses: [16, 17, 18, 20] },
          { number: 4, verses: [1, 2] },
        ],
      },
      {
        id: "1John",
        name: "1 John",
        aliases: ["1Jn"],
        order: 2,
        chapters: [{ number: 1, verses: [1] }],
      },
    ],
    verses: [
      {
        book: "John",
        chapter: 3,
        verse: 16,
        text: "Synthetic verse sixteen: amber lanterns mark the rehearsal path.",
      },
      {
        book: "John",
        chapter: 3,
        verse: 17,
        text: "Synthetic verse seventeen: a quiet room awaits the practice team.",
      },
      {
        book: "John",
        chapter: 3,
        verse: 18,
        text: "Synthetic verse eighteen: blue notebooks hold the rehearsal notes.",
      },
      {
        book: "John",
        chapter: 3,
        verse: 20,
        text: "Synthetic verse twenty: no text is invented for the missing coordinate.",
      },
      {
        book: "John",
        chapter: 4,
        verse: 1,
        text: "Synthetic chapter four: a new practice page begins.",
      },
      {
        book: "John",
        chapter: 4,
        verse: 2,
        text: "Synthetic second entry: lanterns illuminate the test workspace.",
      },
      {
        book: "1John",
        chapter: 1,
        verse: 1,
        text: "Synthetic numbered-book entry for reference parser verification.",
      },
    ],
    integrity: { algorithm: "SHA-256", contentHash: "0".repeat(64) },
  };
}
export async function signFixture(value = fixtureDataset()): Promise<Dataset> {
  value.integrity.contentHash = await sha256(canonicalJSON(unsigned(value)));
  return value;
}
export async function preparedFixture(
  value = fixtureDataset(),
): Promise<PreparedDataset> {
  const dataset = await signFixture(value);
  return parseDataset(new TextEncoder().encode(JSON.stringify(dataset)));
}
