# Local Scripture dataset format v1

Phase 4 accepts a UTF-8 JSON file, maximum 32 MiB (also checked after canonical serialization), either chosen by the user or the bundled King James Version below. There is no remote importer or conversion service in the app. Export and general backup/restore remain outside this phase. Keep the original authorized file separately.

## Alkitab bawaan (bundled Bibles)

The **Alkitab bawaan** section of the Scriptures tab lists:

| Card | Translation | Status | Slide attribution |
| --- | --- | --- | --- |
| **TB2** | Alkitab Terjemahan Baru Edisi Kedua (LAI 2023), Bahasa Indonesia | Not bundled: **Perlu izin LAI** | — |
| **KJV** | King James Version (1769), English, Genesis–Revelation, 31,102 verses | `public/scriptures/kjv.json`, `public-domain` | Public Domain |

**Pasang KJV** downloads the file once and hands it to the normal importer: the same validation, SHA-256 check, license review and attestation checkbox as a user-chosen file. After import the Bible is stored offline like any other dataset; the button then reads **Buka KJV** (or **Sedang dibuka**). A failed download shows a message and writes nothing.

**TB2 is not bundled.** TB2 is copyrighted by Lembaga Alkitab Indonesia (LAI). LAI's text-use policy (alkitab.or.id › Tentang Kami › Penggunaan Teks) allows non-commercial quotation without written permission only up to 1,000 verses and not a whole book; a complete Bible needs LAI's written permission. Neither alkitab-api project carries TB2 (both have TB 1974 only), and copying it from LAI's own site would ignore that policy. The official route is LAI's Bible API (bible-api.alkitab.or.id: account, API key and license agreement). Once a licensed TB2 file is imported with the same edition identity (publisher `Lembaga Alkitab Indonesia`, code `TB2`, edition `2023`, language `id`, versification `LAI TB`), the TB2 card shows it as installed; if LAI's license allows bundling, add a `file` to the TB2 entry in `src/scriptures/builtins.ts`.

The KJV accepts Indonesian and English book names and common abbreviations (OSIS book IDs `Gen` … `Rev`), so `Yoh 3:16`, `Yohanes 3:16`, `John 3:16`, `Mzm 23` and `Psalm 23` all work. Switching between translations keeps the open book and chapter when the other one has it.

### How kjv.json is built

```bash
node scripts/scripture/fetch-sabda.mjs av     # once; caches the 1,189 chapter pages in .cache/sabda
node scripts/scripture/build-datasets.mjs
```

- Text comes from Alkitab Mobile SABDA (alkitab.mobi, version `av`), parsed the way alkitab-api-master does.
- Brackets around supplied (italic) words, the `<< >>` marks around Psalm titles and the Hebrew letter headings of Psalm 119 (ALEPH, BETH, …) are dropped; the words themselves are unchanged. Psalm titles stay at the start of verse 1, as in the source.
- The build stops if any chapter is missing, has verse numbers other than 1..n, text before verse 1, or leftover markup.
- `src/scriptures/builtins.test.ts` checks the file with the app's own validator: 66 books, 1,189 chapters, 31,102 verses, no gaps, known verses (Gen 1:1, John 3:16, Ps 23:1, Rev 22:21) and bilingual references.

## Envelope

Required fields, with no unknown properties:

```ts
{
  format: "sagi-scripture",
  version: 1,
  translation: {
    publisher: string, code: string, name: string,
    abbreviation: string, edition: string, language: string,
    versification: string, coverage: "complete" | "partial",
    source: string,
    license: {
      kind: "public-domain" | "licensed" | "permission",
      notice: string, reference: string, displayAttribution: string,
      permissions: {
        offlineStorage: true, projection: true,
        localSnapshots: true, export: boolean
      }
    }
  },
  books: [{
    id: string, name: string, aliases: string[], order: number,
    chapters: [{number: number, verses: number[]}]
  }],
  verses: [{book: string, chapter: number, verse: number, text: string}],
  integrity: {algorithm: "SHA-256", contentHash: string}
}
```

`language` must be a valid BCP-47 tag. Publisher/code/edition/language/versification identify a logical edition; an existing identity is never overwritten. Identical content is reported as already imported; conflicting content under the same identity is rejected. A genuinely new authorized edition uses different edition metadata and receives a separate local dataset ID.

Book IDs use ASCII letters/digits plus `.`, `_`, `-`, start with a letter/digit, and are unique. Names and aliases belong to the supplied catalog, with no assumed English/Indonesian canon. Ambiguous aliases after NFKC/lowercase/space/period normalization are rejected. Orders must be contiguous from 1. Chapters are ascending integers 1–999; declared verse numbers are ascending integers 1–9999. At most 256 books and 100,000 verses are accepted.

The flat verse list must match the book/chapter manifest exactly in count, coordinates, and order. Missing, duplicate, extra, or reordered records cause rejection of the entire import. Partial editions are allowed when declared; `coverage: complete` is a supplier declaration, not an external completeness certification. Gaps in a requested numeric range produce an error rather than invented text or silent skipping. Non-integer verse labels, merged coordinate labels, and cross-book range syntax are not supported in v1.

Text is nonempty, at most 30,000 UTF-16 code units per verse. Unicode, whitespace, tabs, CRLF, and punctuation are retained exactly. Disallowed control characters and unpaired surrogates are rejected. Metadata labels are trimmed, nonempty, bounded strings. License notice is limited to 10,000 code units and displayed attribution to 300; unsupported custom fields/conditions are rejected. React renders supplied strings as text, never HTML. Source/license references are displayed as plain text and are never fetched.

## Integrity generation

1. Remove only the top-level `integrity` field.
2. Recursively serialize objects with property names sorted using JavaScript `.sort()`; serialize arrays in their original order. Encode keys/scalars using `JSON.stringify`, with no extra whitespace. Do not normalize or modify any string.
3. UTF-8 encode this canonical JSON and calculate SHA-256. Store its 64 lowercase hex digits in `integrity.contentHash`.
4. Serialize the complete envelope as UTF-8 JSON. File indentation is arbitrary; decoded verse text must remain exact.

The implementation is `canonicalJSON`, `unsigned`, and `sha256` in `src/scriptures/importFormat.ts`. An original synthetic fixture and signing helper are in `src/scriptures/testFixtures.ts`; they are used only by tests and are not imported by the application entry points. The fixture is deliberately not a Bible translation.

The import also records SHA-256 of the original file bytes and per-verse coordinate/text hashes. SHA-256 detects accidental content changes; it does not authenticate a publisher or establish usage rights. Stored verses are checked for integrity when read. A party able to rewrite both local content and its hashes remains outside this integrity guarantee.

## Permissions and workflow

The importer requires all three capabilities: offline storage, projection, and retention of local presentation snapshots. Read the actual permission terms before attesting. The application records the supplied notice, permission reference, required display attribution, and attestation timestamp; it cannot verify legal entitlement. `export` is recorded for future policy checks and does not enable an export feature.

If permissions are missing, contradictory, or depend on a condition this format cannot represent/enforce, do not import by removing that condition. Obtain a supported, authorized dataset and request a separate architecture review for unsupported requirements.

Review metadata and check the explicit authorization checkbox before committing. Validation occurs before writes; all records commit in a single WriterGate-tracked transaction. Cancellation, writer loss, request failure, and quota errors abort the transaction. A conservative free-space estimate can refuse an import before opening the write transaction. Other datasets, settings, songs, schedules, and checkpoints are not replaced by import.

## Browsing and presentation

Reference examples use the chosen dataset's aliases: `John 3`, `John 3:16`, `John 3:16-18,20`, `John 3:20-4:2`. Selections are deduplicated and ordered by the imported catalog, with a maximum of 500 verses. Text search is a normalized Unicode literal substring search, not a regex, linguistic index, or concordance. Search normalization never changes stored/displayed text.

Each verse starts a new slide sequence. Long verses continue across exact text slices, each carrying reference, translation abbreviation/edition, attribution, and continuation number. A deck is limited to 10,000 frames and 16 MiB. Renderer overflow rejects the candidate frame and preserves prior output; shorten the selection or choose a fitting layout rather than hiding attribution. Checkpoints retain complete selected text and supplied license metadata so frozen output survives source deletion. They do not retain the entire imported corpus.
