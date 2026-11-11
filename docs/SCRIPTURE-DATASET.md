# Local Scripture dataset format v1

## Two-language Bible (Scriptures tab)

The Scriptures tab holds one section, **Alkitab / Bible**: Indonesian on the left, English on the right.

| File | Translation | License | Slide attribution |
| --- | --- | --- | --- |
| `public/scriptures/ayt.json` | Alkitab Yang Terbuka (AYT) 2024, Bahasa Indonesia | YLSA-AYT, CC BY-NC-SA (non-commercial, attribution) | AYT © YLSA · CC BY-NC-SA |
| `public/scriptures/kjv.json` | King James Version (KJV) 1769, English | Public domain | Public Domain |

Both cover Genesis–Revelation (66 books, 1,189 chapters, 31,102 verses) with the same OSIS book IDs, book order and verse manifest, so every verse has exactly one partner. Book names and common abbreviations work in Indonesian and English (`Kej 1:3-10`, `Genesis 1:3-10`, `Yoh 3:16`).

- **Install:** **Pasang Alkitab** (after the non-commercial consent checkbox) downloads both files once and runs each through the normal importer (`ImportCoordinator`: worker validation, SHA-256, atomic write). They are then ordinary offline datasets.
- **Pick:** Kitab, Pasal, Ayat dari–sampai, or the quick search box (one range within one chapter). Selections are stored on the AYT dataset, exactly like any Scripture selection, so schedules, backups and restore are unchanged.
- **Pairing:** when slides are prepared, `ScriptureRepository.resolveWorkspace` adds the KJV verses with the same coordinates (`partnerOf` / `partnerKey` in `src/scriptures/bilingual.ts`). Without KJV installed the slides stay one-language.
- **Slides:** each verse becomes one or more two-column slides. `Page.parallel` holds the right-hand slice and `ScriptureCaption.parallel` its reference, edition, attribution and full text. Each column is cut with text measured as `PARALLEL_WIDTH` (2.1) times wider, a little narrower than the rendered column (48% of the line, 4% gap), so it always fits; the slide count follows the longer side and the shorter side gets empty slices. `validDeck` requires a licence entry for both datasets and that the slices of each column join back to its exact verse text.
- **Not bundled:** TB Edisi Kedua (© LAI) and ESV (© Crossway) forbid distributing a complete Bible without written permission; they are available through their official APIs instead (below).

### Online TB2 and ESV (official APIs, church's own key)

The **Sumber online** panel under the verse table sets the left column to **TB2** (LAI Bible API) and/or the right column to **ESV** (ESV API). Code: `src/scriptures/online.ts`.

- **Keys** are typed by the operator and kept only in that browser's `localStorage` (`sagi-bible-online`). They are never in the code, the public site, IndexedDB or backups. "Hapus key" removes the key and its cached text.
- **Consent:** each version needs its own checkbox (LAI licence agreement; ESV API conditions) before it can be chosen.
- **Fetching:** only the picked range is requested, 0.5 s after the pick and again on Preview / Tambahkan ke jadwal if anything is missing. ESV: `GET https://api.esv.org/v3/passage/text/?q=BBCCCVVV-BBCCCVVV` with `Authorization: Token <key>`, footnotes and headings off; verses are split on the `[n]` markers. TB2: `GET <alamat API>/bible/<kode versi>/<kitab>/<pasal>/<ayat>` with `Authorization: Bearer <key>` (book as `kejadian`, `1-raja-raja`, `kisah-para-rasul`), following the example on bible-api.alkitab.or.id; LAI's Postman documentation links were offline, so the address and version code (`tb2`) are editable and **Tes TB2** checks four books. Answers must contain exactly the requested verses or they are refused; text is never reworded (only verse markers and indentation are removed).
- **Cache:** at most 500 verses per version (oldest dropped), expiring after 30 days, clearable with **Hapus cache online** — within the ESV API's 500-verse storage limit.
- **Slides:** selections stay on AYT. When slides are prepared, `applyOnline` swaps a column for the cached TB2/ESV text (translation `online:tb2` / `online:esv`, licence kind `permission`, export off, so checkpoints holding it are left out of backups). Attributions: `TB2 © LAI 2023`, `ESV® © Crossway · esv.org`; the ESV copyright notice and a link to www.esv.org are shown in the panel. Verses not cached (e.g. offline) stay AYT/KJV, labelled as such, and the operator gets a note. The ESV omits some verses (e.g. Matthew 17:21); such ranges are refused with a message.
- **ESV from esv.org:** the panel lists ESV first, titled "ESV · esv.org (Crossway)", with links to create an esv.org account (`https://www.esv.org/account/register/`), create an API application for the key (`https://api.esv.org/account/create-application/`) and the API terms. The picked passage has an **esv.org ↗** link (`https://www.esv.org/Genesis+1:3-10/`, built by `esvPassageUrl`), and the attribution line links to www.esv.org, as the ESV API terms require. The esv.org reader itself is not scraped or framed: its terms forbid copying or framing the site.
- The old ESV API v2 (`http://www.esvapi.org/v2/rest/passageQuery?key=IP…`, used by older wrappers such as `esv-api`) was discontinued by Crossway (HTTP 410, "Version 2 of the ESV API has been discontinued"); esvapi.org now redirects to api.esv.org, whose v3 passage-text endpoint this app uses.
- Not verified against the live APIs without real keys; unit and E2E tests use mocked responses.

### Building the files

```bash
node scripts/scripture/build-ayt.mjs <indayt_vpl.txt>   # from https://ebible.org/details.php?id=indayt (indayt_vpl.zip)
node scripts/scripture/fetch-sabda.mjs av                # once; caches KJV chapter pages in .cache/sabda
node scripts/scripture/build-kjv.mjs
```

AYT text is kept exactly as published. KJV comes from Alkitab Mobile SABDA (the alkitab-api-master source); supplied-word brackets, `<< >>` title marks, Psalm 119 letter headings and the subscriptions after Paul's letters are dropped, and the result was checked letter by letter against a second KJV source. `src/scriptures/bilingual.test.ts` validates both files with the app's own importer and checks the two-column slides.

## Dataset format

Phase 4 accepts only a user-selected UTF-8 JSON file, maximum 32 MiB (also checked after canonical serialization). There is no bundled translation, remote importer, or conversion service. Export and general backup/restore remain outside this phase. Keep the original authorized file separately.

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
