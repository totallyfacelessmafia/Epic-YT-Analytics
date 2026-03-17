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

    CREATE INDEX IF NOT EXISTS idx_scripts_word ON scripts(word);
    CREATE INDEX IF NOT EXISTS idx_scripts_character ON scripts(character_id);
    CREATE INDEX IF NOT EXISTS idx_metadata_drive ON metadata_history(drive_file_id);
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
