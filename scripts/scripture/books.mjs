// The 66-book Protestant canon, Genesis (Kejadian) to Revelation (Wahyu).
// Bundled datasets use these book IDs (OSIS) and accept Indonesian and
// English names, so "Yoh 3:16" and "John 3:16" both work.
// Fields: OSIS id, alkitab.mobi code, chapter count, Indonesian name,
// English name, Indonesian aliases, English aliases.
const rows = [
  ["Gen", "Kej", 50, "Kejadian", "Genesis", ["Kej"], ["Gn"]],
  ["Exod", "Kel", 40, "Keluaran", "Exodus", ["Kel"], ["Ex", "Exo"]],
  ["Lev", "Ima", 27, "Imamat", "Leviticus", ["Im", "Ima"], ["Lv"]],
  ["Num", "Bil", 36, "Bilangan", "Numbers", ["Bil"], ["Nm", "Nu"]],
  ["Deut", "Ula", 34, "Ulangan", "Deuteronomy", ["Ul", "Ula"], ["Dt"]],
  ["Josh", "Yos", 24, "Yosua", "Joshua", ["Yos"], ["Jos"]],
  ["Judg", "Hak", 21, "Hakim-hakim", "Judges", ["Hak", "Hakim hakim"], ["Jdg"]],
  ["Ruth", "Rut", 4, "Rut", "Ruth", [], ["Rth"]],
  ["1Sam", "1Sa", 31, "1 Samuel", "1 Samuel", ["1Sa"], ["1Sm"]],
  ["2Sam", "2Sa", 24, "2 Samuel", "2 Samuel", ["2Sa"], ["2Sm"]],
  ["1Kgs", "1Ra", 22, "1 Raja-raja", "1 Kings", ["1Raj", "1Ra", "1 Raja", "1 Raja raja"], ["1Ki", "1Kin"]],
  ["2Kgs", "2Ra", 25, "2 Raja-raja", "2 Kings", ["2Raj", "2Ra", "2 Raja", "2 Raja raja"], ["2Ki", "2Kin"]],
  ["1Chr", "1Ta", 29, "1 Tawarikh", "1 Chronicles", ["1Taw", "1Ta"], ["1Ch", "1Chron"]],
  ["2Chr", "2Ta", 36, "2 Tawarikh", "2 Chronicles", ["2Taw", "2Ta"], ["2Ch", "2Chron"]],
  ["Ezra", "Ezr", 10, "Ezra", "Ezra", ["Ezr"], []],
  ["Neh", "Neh", 13, "Nehemia", "Nehemiah", [], []],
  ["Esth", "Est", 10, "Ester", "Esther", ["Est"], []],
  ["Job", "Ayb", 42, "Ayub", "Job", ["Ayb"], ["Jb"]],
  ["Ps", "Mzm", 150, "Mazmur", "Psalms", ["Mzm", "Maz"], ["Psalm", "Psa", "Pss"]],
  ["Prov", "Ams", 31, "Amsal", "Proverbs", ["Ams"], ["Pro", "Prv"]],
  ["Eccl", "Pkh", 12, "Pengkhotbah", "Ecclesiastes", ["Pkh", "Pengkotbah"], ["Ecc", "Qoh"]],
  ["Song", "Kid", 8, "Kidung Agung", "Song of Solomon", ["Kid", "Kidung"], ["Song of Songs", "SOS", "Sng"]],
  ["Isa", "Yes", 66, "Yesaya", "Isaiah", ["Yes"], ["Is"]],
  ["Jer", "Yer", 52, "Yeremia", "Jeremiah", ["Yer"], ["Jr"]],
  ["Lam", "Rat", 5, "Ratapan", "Lamentations", ["Rat"], ["La"]],
  ["Ezek", "Yeh", 48, "Yehezkiel", "Ezekiel", ["Yeh"], ["Eze", "Ezk"]],
  ["Dan", "Dan", 12, "Daniel", "Daniel", [], ["Dn"]],
  ["Hos", "Hos", 14, "Hosea", "Hosea", [], []],
  ["Joel", "Yoe", 3, "Yoel", "Joel", ["Yl", "Yoe"], ["Jl"]],
  ["Amos", "Amo", 9, "Amos", "Amos", ["Am", "Amo"], []],
  ["Obad", "Oba", 1, "Obaja", "Obadiah", ["Ob", "Oba"], []],
  ["Jonah", "Yun", 4, "Yunus", "Jonah", ["Yun"], ["Jnh"]],
  ["Mic", "Mik", 7, "Mikha", "Micah", ["Mi", "Mik"], []],
  ["Nah", "Nah", 3, "Nahum", "Nahum", [], []],
  ["Hab", "Hab", 3, "Habakuk", "Habakkuk", [], []],
  ["Zeph", "Zef", 3, "Zefanya", "Zephaniah", ["Zef"], ["Zep"]],
  ["Hag", "Hag", 2, "Hagai", "Haggai", [], []],
  ["Zech", "Zak", 14, "Zakharia", "Zechariah", ["Za", "Zak", "Zakaria"], ["Zec"]],
  ["Mal", "Mal", 4, "Maleakhi", "Malachi", [], []],
  ["Matt", "Mat", 28, "Matius", "Matthew", ["Mat"], ["Mt"]],
  ["Mark", "Mrk", 16, "Markus", "Mark", ["Mrk"], ["Mk"]],
  ["Luke", "Luk", 24, "Lukas", "Luke", ["Luk"], ["Lk"]],
  ["John", "Yoh", 21, "Yohanes", "John", ["Yoh"], ["Jn", "Jhn"]],
  ["Acts", "Kis", 28, "Kisah Para Rasul", "Acts", ["Kis", "Kisah Rasul"], ["Act"]],
  ["Rom", "Rom", 16, "Roma", "Romans", ["Rm"], ["Ro"]],
  ["1Cor", "1Ko", 16, "1 Korintus", "1 Corinthians", ["1Kor", "1Ko"], ["1Co"]],
  ["2Cor", "2Ko", 13, "2 Korintus", "2 Corinthians", ["2Kor", "2Ko"], ["2Co"]],
  ["Gal", "Gal", 6, "Galatia", "Galatians", [], []],
  ["Eph", "Efe", 6, "Efesus", "Ephesians", ["Ef", "Efe"], []],
  ["Phil", "Flp", 4, "Filipi", "Philippians", ["Flp", "Fil"], ["Php"]],
  ["Col", "Kol", 4, "Kolose", "Colossians", ["Kol"], []],
  ["1Thess", "1Te", 5, "1 Tesalonika", "1 Thessalonians", ["1Tes", "1Te"], ["1Th"]],
  ["2Thess", "2Te", 3, "2 Tesalonika", "2 Thessalonians", ["2Tes", "2Te"], ["2Th"]],
  ["1Tim", "1Ti", 6, "1 Timotius", "1 Timothy", ["1Ti"], []],
  ["2Tim", "2Ti", 4, "2 Timotius", "2 Timothy", ["2Ti"], []],
  ["Titus", "Tit", 3, "Titus", "Titus", ["Tit"], []],
  ["Phlm", "Flm", 1, "Filemon", "Philemon", ["Flm"], ["Phm"]],
  ["Heb", "Ibr", 13, "Ibrani", "Hebrews", ["Ibr"], []],
  ["Jas", "Yak", 5, "Yakobus", "James", ["Yak"], ["Jm"]],
  ["1Pet", "1Pt", 5, "1 Petrus", "1 Peter", ["1Ptr", "1Pt"], ["1Pe"]],
  ["2Pet", "2Pt", 3, "2 Petrus", "2 Peter", ["2Ptr", "2Pt"], ["2Pe"]],
  ["1John", "1Yo", 5, "1 Yohanes", "1 John", ["1Yoh", "1Yo"], ["1Jn", "1Jhn"]],
  ["2John", "2Yo", 1, "2 Yohanes", "2 John", ["2Yoh", "2Yo"], ["2Jn", "2Jhn"]],
  ["3John", "3Yo", 1, "3 Yohanes", "3 John", ["3Yoh", "3Yo"], ["3Jn", "3Jhn"]],
  ["Jude", "Yud", 1, "Yudas", "Jude", ["Yud"], []],
  ["Rev", "Why", 22, "Wahyu", "Revelation", ["Why"], ["Rv", "Revelations"]],
];

export const BOOKS = rows.map(
  ([osis, sabda, chapters, id, en, idAliases, enAliases], index) => ({
    osis,
    sabda,
    chapters,
    order: index + 1,
    names: { id, en },
    aliases: { id: idAliases, en: enAliases },
  }),
);

/** Display name plus aliases for one language, with the other language's names as extra aliases. */
export function catalogEntry(book, language) {
  const other = language === "id" ? "en" : "id";
  const name = book.names[language];
  const seen = new Set([name.toLowerCase(), book.osis.toLowerCase()]);
  const aliases = [];
  for (const alias of [
    ...book.aliases[language],
    book.names[other],
    ...book.aliases[other],
  ]) {
    const key = alias.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      aliases.push(alias);
    }
  }
  return { id: book.osis, name, aliases, order: book.order };
}
