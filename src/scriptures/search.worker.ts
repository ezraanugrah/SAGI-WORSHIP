import { searchNormalize } from "./references";
import type { Verse } from "./models";
let rows: { verse: Verse; normalized: string }[] = [];
let generation = "";
self.onmessage = (event: MessageEvent) => {
  const value = event.data;
  if (value.type === "load") {
    if (value.generation !== generation) {
      rows = [];
      generation = value.generation;
    }
    rows.push(
      ...(value.rows as Verse[]).map((verse) => ({
        verse,
        normalized: searchNormalize(verse.text),
      })),
    );
    return;
  }
  if (value.type === "search" && value.generation === generation) {
    const query = searchNormalize(value.query);
    const found = query
      ? rows.filter((row) => row.normalized.includes(query))
      : [];
    self.postMessage({
      generation,
      requestId: value.requestId,
      total: found.length,
      results: found
        .slice(value.offset, value.offset + 100)
        .map((row) => row.verse),
    });
  }
  if (value.type === "clear") {
    rows = [];
    generation = "";
  }
};
