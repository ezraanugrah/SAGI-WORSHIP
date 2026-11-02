import { describe, expect, it } from "vitest";
import {
  move,
  searchSongs,
  validSongInput,
  validDraft,
  sectionTypes,
  now,
  type Song,
} from "./models";
import { songFixture } from "../testHelpers";
describe("song validation and ordering", () => {
  it("supports all five section types and repeated presentation sections", () => {
    const input = songFixture("song");
    input.sections = sectionTypes.map((type, i) => ({
      id: `s${i}`,
      songId: "song",
      type,
      label: type,
      text: "Original test text",
    }));
    input.order = ["s0", "s1", "s2", "s1", "s4"];
    expect(validSongInput(input, "song")).toBe(true);
  });
  it("rejects blank canonical lyrics, invalid types, duplicate IDs and dangling section references", () => {
    const input = songFixture("song");
    expect(validSongInput({ ...input, title: " " }, "song")).toBe(false);
    expect(
      validSongInput(
        { ...input, sections: [{ ...input.sections[0], text: "" }] },
        "song",
      ),
    ).toBe(false);
    expect(validSongInput({ ...input, order: ["missing"] }, "song")).toBe(
      false,
    );
    expect(
      validSongInput(
        { ...input, sections: [...input.sections, ...input.sections] },
        "song",
      ),
    ).toBe(false);
    expect(
      validSongInput(
        { ...input, sections: [{ ...input.sections[0], type: "Other" }] },
        "song",
      ),
    ).toBe(false);
    expect(validSongInput({ ...input, title: "x".repeat(201) }, "song")).toBe(
      false,
    );
  });
  it("allows bounded incomplete drafts without treating them as valid songs", () => {
    const input = { ...songFixture("song"), title: "" };
    expect(validSongInput(input, "song")).toBe(false);
    expect(
      validDraft({
        id: "phase2:draft:song:song",
        kind: "song-draft",
        songId: "song",
        baseRevision: 0,
        sequence: 1,
        value: input,
        updatedAt: now(),
      }),
    ).toBe(true);
  });
  it("searches title and lyrics case-insensitively without modifying data", () => {
    const input = songFixture("song", "Morning Test");
    const song: Song = {
      ...input,
      id: "song",
      revision: 1,
      createdAt: now(),
      updatedAt: now(),
    };
    expect(searchSongs([song], "morning")).toEqual([song]);
    expect(searchSongs([song], "SOFTWARE")).toEqual([song]);
    expect(searchSongs([song], "absent")).toEqual([]);
  });
  it("moves entries without mutation and ignores invalid positions", () => {
    const source = ["a", "b", "c"];
    expect(move(source, 0, 2)).toEqual(["b", "c", "a"]);
    expect(source).toEqual(["a", "b", "c"]);
    expect(move(source, -1, 2)).toBe(source);
    expect(move(source, 0, 3)).toBe(source);
  });
});
