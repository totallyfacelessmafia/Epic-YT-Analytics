import Database from "better-sqlite3";
import path from "path";

/* ------------------------------------------------------------------ */
/*  Singleton database connection                                      */
/* ------------------------------------------------------------------ */

const DB_PATH = path.join(process.cwd(), "data", "epic.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure directory exists
  const fs = require("fs");
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Run migrations
  migrate(_db);

  return _db;
}

/* ------------------------------------------------------------------ */
/*  Schema migrations                                                  */
/* ------------------------------------------------------------------ */

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      visual_dna TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id              TEXT PRIMARY KEY,
      word            TEXT NOT NULL,
      character_id    TEXT NOT NULL,
      character_name  TEXT NOT NULL,
      setting         TEXT NOT NULL DEFAULT '',
      background      TEXT NOT NULL DEFAULT '',
      script          TEXT NOT NULL DEFAULT '',
      narrator_lines  TEXT NOT NULL DEFAULT '[]',
      negative_prompt TEXT NOT NULL DEFAULT '',
      color_category  TEXT NOT NULL DEFAULT '',
      bg_color        TEXT NOT NULL DEFAULT '',
      generated_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS metadata_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      drive_file_id   TEXT NOT NULL,
      filename        TEXT NOT NULL,
      title           TEXT NOT NULL,
      description     TEXT NOT NULL,
      tags            TEXT NOT NULL DEFAULT '[]',
      youtube_url     TEXT,
      youtube_id      TEXT,
      status          TEXT NOT NULL DEFAULT 'generated',
      created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS words (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      word        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      status      TEXT NOT NULL DEFAULT 'pending',
      character_id TEXT,
      added_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      produced_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_scripts_word ON scripts(word);
    CREATE INDEX IF NOT EXISTS idx_scripts_character ON scripts(character_id);
    CREATE INDEX IF NOT EXISTS idx_metadata_drive ON metadata_history(drive_file_id);
    CREATE INDEX IF NOT EXISTS idx_words_status ON words(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_words_unique ON words(word);
  `);

  // Seed default Kitten Ninja character if not exists
  const existing = db
    .prepare("SELECT id FROM characters WHERE id = ?")
    .get("kitten-ninja");

  if (!existing) {
    db.prepare(
      "INSERT INTO characters (id, name, visual_dna, created_at) VALUES (?, ?, ?, ?)"
    ).run(
      "kitten-ninja",
      "Kitten Ninja",
      `Kitten Ninja is a cute chibi-style grey cat wearing a black ninja gi uniform with red/coral trim, a red/coral ninja mask on his face, and a red/coral scarf around his neck.
EYES: MUST be two small solid black dots ONLY. No eyebrows, no eyelashes, no white sclera, no blinking.
MOUTH: MUST be a simple open happy "u" shape. It is a static black outline. No tongue, no teeth, no movement.
PAWS: Round pink pads with NO claws.
STYLE: 2D clean-line cartoon. No realistic fur, no shading gradients, no 3D rendering. Flat colors only.
PERSONALITY: Brave but clumsy. Tries hard to be cool but always has a small comedic fail.`,
      Date.now()
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Character CRUD                                                     */
/* ------------------------------------------------------------------ */

export interface DbCharacter {
  id: string;
  name: string;
  visual_dna: string;
  created_at: number;
}

export function getAllCharacters(): DbCharacter[] {
  return getDb().prepare("SELECT * FROM characters ORDER BY created_at ASC").all() as DbCharacter[];
}

export function getCharacter(id: string): DbCharacter | undefined {
  return getDb().prepare("SELECT * FROM characters WHERE id = ?").get(id) as DbCharacter | undefined;
}

export function createCharacter(id: string, name: string, visualDna: string): DbCharacter {
  const now = Date.now();
  getDb()
    .prepare("INSERT INTO characters (id, name, visual_dna, created_at) VALUES (?, ?, ?, ?)")
    .run(id, name, visualDna, now);
  return { id, name, visual_dna: visualDna, created_at: now };
}

export function updateCharacter(id: string, visualDna: string): void {
  getDb().prepare("UPDATE characters SET visual_dna = ? WHERE id = ?").run(visualDna, id);
}

export function deleteCharacter(id: string): void {
  getDb().prepare("DELETE FROM characters WHERE id = ?").run(id);
}

/* ------------------------------------------------------------------ */
/*  Script CRUD                                                        */
/* ------------------------------------------------------------------ */

export interface DbScript {
  id: string;
  word: string;
  character_id: string;
  character_name: string;
  setting: string;
  background: string;
  script: string;
  narrator_lines: string; // JSON string
  negative_prompt: string;
  color_category: string;
  bg_color: string;
  generated_at: number;
}

export function getAllScripts(): DbScript[] {
  return getDb().prepare("SELECT * FROM scripts ORDER BY generated_at DESC").all() as DbScript[];
}

export function createScript(s: Omit<DbScript, "generated_at"> & { generated_at?: number }): DbScript {
  const now = s.generated_at ?? Date.now();
  getDb()
    .prepare(
      `INSERT INTO scripts (id, word, character_id, character_name, setting, background, script, narrator_lines, negative_prompt, color_category, bg_color, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      s.id, s.word, s.character_id, s.character_name, s.setting, s.background,
      s.script, s.narrator_lines, s.negative_prompt, s.color_category ?? "", s.bg_color ?? "", now
    );
  return { ...s, generated_at: now } as DbScript;
}

export function deleteScript(id: string): void {
  getDb().prepare("DELETE FROM scripts WHERE id = ?").run(id);
}

export function clearAllScripts(): void {
  getDb().prepare("DELETE FROM scripts").run();
}

/* ------------------------------------------------------------------ */
/*  Metadata History CRUD                                              */
/* ------------------------------------------------------------------ */

export interface DbMetadata {
  id: number;
  drive_file_id: string;
  filename: string;
  title: string;
  description: string;
  tags: string; // JSON string
  youtube_url: string | null;
  youtube_id: string | null;
  status: string;
  created_at: number;
}

export function getAllMetadata(): DbMetadata[] {
  return getDb().prepare("SELECT * FROM metadata_history ORDER BY created_at DESC").all() as DbMetadata[];
}

export function createMetadata(m: {
  drive_file_id: string;
  filename: string;
  title: string;
  description: string;
  tags: string[];
}): DbMetadata {
  const now = Date.now();
  const result = getDb()
    .prepare(
      `INSERT INTO metadata_history (drive_file_id, filename, title, description, tags, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'generated', ?)`
    )
    .run(m.drive_file_id, m.filename, m.title, m.description, JSON.stringify(m.tags), now);
  return {
    id: result.lastInsertRowid as number,
    drive_file_id: m.drive_file_id,
    filename: m.filename,
    title: m.title,
    description: m.description,
    tags: JSON.stringify(m.tags),
    youtube_url: null,
    youtube_id: null,
    status: "generated",
    created_at: now,
  };
}

export function updateMetadataUpload(
  driveFileId: string,
  youtubeUrl: string,
  youtubeId: string
): void {
  getDb()
    .prepare(
      "UPDATE metadata_history SET youtube_url = ?, youtube_id = ?, status = 'uploaded' WHERE drive_file_id = ? AND status = 'generated'"
    )
    .run(youtubeUrl, youtubeId, driveFileId);
}

/* ------------------------------------------------------------------ */
/*  Word Library CRUD                                                  */
/* ------------------------------------------------------------------ */

export interface DbWord {
  id: number;
  word: string;
  status: string; // 'pending' | 'produced'
  character_id: string | null;
  added_at: number;
  produced_at: number | null;
}

export function getAllWords(): DbWord[] {
  return getDb().prepare("SELECT * FROM words ORDER BY status ASC, added_at DESC").all() as DbWord[];
}

export function getPendingWords(): DbWord[] {
  return getDb().prepare("SELECT * FROM words WHERE status = 'pending' ORDER BY added_at ASC").all() as DbWord[];
}

export function getProducedWords(): DbWord[] {
  return getDb().prepare("SELECT * FROM words WHERE status = 'produced' ORDER BY produced_at DESC").all() as DbWord[];
}

export function wordExists(word: string): boolean {
  const row = getDb().prepare("SELECT id FROM words WHERE word = ? COLLATE NOCASE").get(word);
  return !!row;
}

export function getWordStatus(word: string): DbWord | undefined {
  return getDb().prepare("SELECT * FROM words WHERE word = ? COLLATE NOCASE").get(word) as DbWord | undefined;
}

export function addWord(word: string): DbWord | null {
  const existing = getDb().prepare("SELECT * FROM words WHERE word = ? COLLATE NOCASE").get(word) as DbWord | undefined;
  if (existing) return null; // duplicate
  const now = Date.now();
  const result = getDb()
    .prepare("INSERT INTO words (word, status, added_at) VALUES (?, 'pending', ?)")
    .run(word.toLowerCase().trim(), now);
  return { id: result.lastInsertRowid as number, word: word.toLowerCase().trim(), status: "pending", character_id: null, added_at: now, produced_at: null };
}

export function addWordsFromCsv(words: string[]): { added: number; duplicates: number } {
  let added = 0;
  let duplicates = 0;
  const insert = getDb().prepare("INSERT OR IGNORE INTO words (word, status, added_at) VALUES (?, 'pending', ?)");
  const now = Date.now();

  const tx = getDb().transaction(() => {
    for (const w of words) {
      const clean = w.toLowerCase().trim();
      if (!clean) continue;
      const result = insert.run(clean, now);
      if (result.changes > 0) added++;
      else duplicates++;
    }
  });
  tx();
  return { added, duplicates };
}

export function markWordProduced(word: string, characterId?: string): void {
  getDb()
    .prepare("UPDATE words SET status = 'produced', produced_at = ?, character_id = ? WHERE word = ? COLLATE NOCASE")
    .run(Date.now(), characterId ?? null, word);
}

export function markWordPending(word: string): void {
  getDb()
    .prepare("UPDATE words SET status = 'pending', produced_at = NULL, character_id = NULL WHERE word = ? COLLATE NOCASE")
    .run(word);
}

export function deleteWord(word: string): void {
  getDb().prepare("DELETE FROM words WHERE word = ? COLLATE NOCASE").run(word);
}

/** Check if a script already exists for this word (regardless of word library) */
export function scriptExistsForWord(word: string): boolean {
  const row = getDb().prepare("SELECT id FROM scripts WHERE word = ? COLLATE NOCASE LIMIT 1").get(word);
  return !!row;
}

/** Get all words that have been uploaded to YouTube (for cross-referencing) */
export function getUploadedWordsList(): string[] {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT LOWER(REPLACE(REPLACE(filename, '.mp4', ''), 'word_', '')) as word
       FROM metadata_history WHERE status = 'uploaded'`
    )
    .all() as { word: string }[];
  return rows.map((r) => r.word);
}

/** Get all words that have generated scripts */
export function getScriptedWords(): string[] {
  const rows = getDb()
    .prepare("SELECT DISTINCT LOWER(word) as word FROM scripts")
    .all() as { word: string }[];
  return rows.map((r) => r.word);
}

/* ------------------------------------------------------------------ */
/*  Sight Word Seeder                                                  */
/* ------------------------------------------------------------------ */

/** Pre-seed Dolch & Fry kindergarten sight words (only adds new ones) */
export function seedSightWords(): { added: number; duplicates: number } {
  const DOLCH_FRY_KINDERGARTEN = [
    // Dolch Pre-Primer
    "a", "and", "away", "big", "blue", "can", "come", "down",
    "find", "for", "funny", "go", "help", "here", "i", "in",
    "is", "it", "jump", "little", "look", "make", "me", "my",
    "not", "one", "play", "red", "run", "said", "see", "the",
    "three", "to", "two", "up", "we", "where", "yellow", "you",
    // Dolch Primer
    "all", "am", "are", "at", "ate", "be", "black", "brown",
    "but", "came", "did", "do", "eat", "four", "get", "good",
    "have", "he", "into", "like", "must", "new", "no", "now",
    "on", "our", "out", "please", "pretty", "ran", "ride",
    "saw", "say", "she", "so", "soon", "that", "there", "they",
    "this", "too", "under", "want", "was", "well", "went",
    "what", "white", "who", "will", "with", "yes",
    // Dolch First Grade
    "after", "again", "an", "any", "ask", "as", "by", "could",
    "every", "fly", "from", "give", "going", "had", "has", "her",
    "him", "his", "how", "just", "know", "let", "live", "may",
    "of", "old", "once", "open", "over", "put", "round", "some",
    "stop", "take", "thank", "them", "then", "think", "walk",
    "were", "when",
    // Extra high-frequency words for kindergarten
    "fast", "slow", "high", "low", "near", "far", "hard", "soft",
    "hot", "cold", "push", "pull", "sit", "stand", "read", "write",
    "sing", "dance", "draw", "cut", "grow", "fall", "tell", "show",
    "happy", "sad", "mad", "glad", "kind", "nice", "brave", "love",
  ];

  return addWordsFromCsv(DOLCH_FRY_KINDERGARTEN);
}
