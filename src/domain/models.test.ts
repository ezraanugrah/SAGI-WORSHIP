import { describe, expect, it } from "vitest";
import {
  move,
  searchSongs,
  validSongInput,
  validDraft,
  withSectionLabels,
  nextSectionChoice,
  sectionChoices,
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
  it("offers six song parts that are all valid section types", () => {
    expect(sectionChoices.map((c) => c.label)).toEqual([
      "Intro",
      "Verse 1",
      "Verse 2",
      "Pre Chorus",
      "Chorus",
      "Bridge",
    ]);
    expect(sectionChoices.every((c) => sectionTypes.includes(c.type))).toBe(
      true,
    );
    expect(nextSectionChoice([{ label: "Verse 1" }]).label).toBe("Verse 2");
    expect(
      nextSectionChoice(sectionChoices.map((c) => ({ label: c.label }))).label,
    ).toBe("Chorus");
  });
  it("lets a draft keep a blank label and fills labels from the type when saving", () => {
    const input = songFixture("song");
    input.sections = [
      { id: "a", songId: "song", type: "Verse", label: "", text: "x" },
      { id: "b", songId: "song", type: "Chorus", label: "Reff", text: "y" },
      { id: "c", songId: "song", type: "Verse", label: "  ", text: "z" },
    ];
    input.order = ["a", "b", "c"];
    expect(validSongInput(input, "song")).toBe(false);
    expect(validSongInput(input, "song", true)).toBe(true);
    const song = withSectionLabels(input);
    expect(song.sections.map((x) => x.label)).toEqual([
      "Verse",
      "Reff",
      "Verse 2",
    ]);
    expect(validSongInput(song, "song")).toBe(true);
  });
  it("accepts an empty part (blank slide) when another part has lyrics", () => {
    const input = songFixture("song");
    input.sections = [
      { id: "a", songId: "song", type: "Intro", label: "Intro", text: "" },
      { id: "b", songId: "song", type: "Verse", label: "Verse 1", text: "x" },
    ];
    input.order = ["a", "b"];
    expect(validSongInput(input, "song")).toBe(true);
    input.sections[1].text = " ";
    expect(validSongInput(input, "song")).toBe(false);
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
