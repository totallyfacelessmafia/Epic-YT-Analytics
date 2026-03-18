import { createClient, type Client, type InStatement } from "@libsql/client/web";

/* ------------------------------------------------------------------ */
/*  Singleton database connection                                      */
/* ------------------------------------------------------------------ */

let _client: Client | null = null;

function getClient(): Client {
  if (_client) return _client;

  _client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:data/epic.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  return _client;
}

let _migrated = false;

async function ensureMigrated(): Promise<Client> {
  const client = getClient();
  if (_migrated) return client;

  await client.executeMultiple(`
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
      word        TEXT NOT NULL UNIQUE,
      status      TEXT NOT NULL DEFAULT 'pending',
      character_id TEXT,
      added_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      produced_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_scripts_word ON scripts(word);
    CREATE INDEX IF NOT EXISTS idx_scripts_character ON scripts(character_id);
    CREATE INDEX IF NOT EXISTS idx_metadata_drive ON metadata_history(drive_file_id);
    CREATE INDEX IF NOT EXISTS idx_words_status ON words(status);
  `);

  // Seed default Kitten Ninja character if not exists
  await client.execute({
    sql: "INSERT OR IGNORE INTO characters (id, name, visual_dna, created_at) VALUES (?, ?, ?, ?)",
    args: [
        "kitten-ninja",
        "Kitten Ninja",
        `Kitten Ninja is a cute chibi-style grey cat wearing a black ninja gi uniform with red/coral trim, a red/coral ninja mask on his face, and a red/coral scarf around his neck.
EYES: MUST be two small solid black dots ONLY. No eyebrows, no eyelashes, no white sclera, no blinking.
MOUTH: MUST be a simple open happy "u" shape. It is a static black outline. No tongue, no teeth, no movement.
PAWS: Round pink pads with NO claws.
STYLE: 2D clean-line cartoon. No realistic fur, no shading gradients, no 3D rendering. Flat colors only.
PERSONALITY: Brave but clumsy. Tries hard to be cool but always has a small comedic fail.`,
        Date.now(),
      ],
    });

  _migrated = true;
  return client;
}

/* ------------------------------------------------------------------ */
/*  Helper to convert rows to typed objects                            */
/* ------------------------------------------------------------------ */

function rowToObj<T>(row: Record<string, unknown>): T {
  return row as unknown as T;
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

export async function getAllCharacters(): Promise<DbCharacter[]> {
  const db = await ensureMigrated();
  const result = await db.execute("SELECT * FROM characters ORDER BY created_at ASC");
  return result.rows.map((r) => rowToObj<DbCharacter>(r as unknown as Record<string, unknown>));
}

export async function getCharacter(id: string): Promise<DbCharacter | undefined> {
  const db = await ensureMigrated();
  const result = await db.execute({ sql: "SELECT * FROM characters WHERE id = ?", args: [id] });
  return result.rows.length > 0 ? rowToObj<DbCharacter>(result.rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function createCharacter(id: string, name: string, visualDna: string): Promise<DbCharacter> {
  const db = await ensureMigrated();
  const now = Date.now();
  await db.execute({
    sql: "INSERT INTO characters (id, name, visual_dna, created_at) VALUES (?, ?, ?, ?)",
    args: [id, name, visualDna, now],
  });
  return { id, name, visual_dna: visualDna, created_at: now };
}

export async function updateCharacter(id: string, visualDna: string): Promise<void> {
  const db = await ensureMigrated();
  await db.execute({ sql: "UPDATE characters SET visual_dna = ? WHERE id = ?", args: [visualDna, id] });
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await ensureMigrated();
  await db.execute({ sql: "DELETE FROM characters WHERE id = ?", args: [id] });
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
  narrator_lines: string;
  negative_prompt: string;
  color_category: string;
  bg_color: string;
  generated_at: number;
}

export async function getAllScripts(): Promise<DbScript[]> {
  const db = await ensureMigrated();
  const result = await db.execute("SELECT * FROM scripts ORDER BY generated_at DESC");
  return result.rows.map((r) => rowToObj<DbScript>(r as unknown as Record<string, unknown>));
}

export async function createScript(s: Omit<DbScript, "generated_at"> & { generated_at?: number }): Promise<DbScript> {
  const db = await ensureMigrated();
  const now = s.generated_at ?? Date.now();
  await db.execute({
    sql: `INSERT INTO scripts (id, word, character_id, character_name, setting, background, script, narrator_lines, negative_prompt, color_category, bg_color, generated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      s.id, s.word, s.character_id, s.character_name, s.setting, s.background,
      s.script, s.narrator_lines, s.negative_prompt, s.color_category ?? "", s.bg_color ?? "", now,
    ],
  });
  return { ...s, generated_at: now } as DbScript;
}

export async function deleteScript(id: string): Promise<void> {
  const db = await ensureMigrated();
  await db.execute({ sql: "DELETE FROM scripts WHERE id = ?", args: [id] });
}

export async function clearAllScripts(): Promise<void> {
  const db = await ensureMigrated();
  await db.execute("DELETE FROM scripts");
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
  tags: string;
  youtube_url: string | null;
  youtube_id: string | null;
  status: string;
  created_at: number;
}

export async function getAllMetadata(): Promise<DbMetadata[]> {
  const db = await ensureMigrated();
  const result = await db.execute("SELECT * FROM metadata_history ORDER BY created_at DESC");
  return result.rows.map((r) => rowToObj<DbMetadata>(r as unknown as Record<string, unknown>));
}

export async function createMetadata(m: {
  drive_file_id: string;
  filename: string;
  title: string;
  description: string;
  tags: string[];
}): Promise<DbMetadata> {
  const db = await ensureMigrated();
  const now = Date.now();
  const result = await db.execute({
    sql: `INSERT INTO metadata_history (drive_file_id, filename, title, description, tags, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'generated', ?)`,
    args: [m.drive_file_id, m.filename, m.title, m.description, JSON.stringify(m.tags), now],
  });
  return {
    id: Number(result.lastInsertRowid),
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

export async function updateMetadataUpload(
  driveFileId: string,
  youtubeUrl: string,
  youtubeId: string
): Promise<void> {
  const db = await ensureMigrated();
  await db.execute({
    sql: "UPDATE metadata_history SET youtube_url = ?, youtube_id = ?, status = 'uploaded' WHERE drive_file_id = ? AND status = 'generated'",
    args: [youtubeUrl, youtubeId, driveFileId],
  });
}

/* ------------------------------------------------------------------ */
/*  Word Library CRUD                                                  */
/* ------------------------------------------------------------------ */

export interface DbWord {
  id: number;
  word: string;
  status: string;
  character_id: string | null;
  added_at: number;
  produced_at: number | null;
}

export async function getAllWords(): Promise<DbWord[]> {
  const db = await ensureMigrated();
  const result = await db.execute("SELECT * FROM words ORDER BY status ASC, added_at DESC");
  return result.rows.map((r) => rowToObj<DbWord>(r as unknown as Record<string, unknown>));
}

export async function getPendingWords(): Promise<DbWord[]> {
  const db = await ensureMigrated();
  const result = await db.execute("SELECT * FROM words WHERE status = 'pending' ORDER BY added_at ASC");
  return result.rows.map((r) => rowToObj<DbWord>(r as unknown as Record<string, unknown>));
}

export async function getProducedWords(): Promise<DbWord[]> {
  const db = await ensureMigrated();
  const result = await db.execute("SELECT * FROM words WHERE status = 'produced' ORDER BY produced_at DESC");
  return result.rows.map((r) => rowToObj<DbWord>(r as unknown as Record<string, unknown>));
}

export async function wordExists(word: string): Promise<boolean> {
  const db = await ensureMigrated();
  const result = await db.execute({ sql: "SELECT id FROM words WHERE LOWER(word) = LOWER(?)", args: [word] });
  return result.rows.length > 0;
}

export async function getWordStatus(word: string): Promise<DbWord | undefined> {
  const db = await ensureMigrated();
  const result = await db.execute({ sql: "SELECT * FROM words WHERE LOWER(word) = LOWER(?)", args: [word] });
  return result.rows.length > 0 ? rowToObj<DbWord>(result.rows[0] as unknown as Record<string, unknown>) : undefined;
}

export async function addWord(word: string): Promise<DbWord | null> {
  const db = await ensureMigrated();
  const existing = await db.execute({ sql: "SELECT * FROM words WHERE LOWER(word) = LOWER(?)", args: [word] });
  if (existing.rows.length > 0) return null;
  const now = Date.now();
  const clean = word.toLowerCase().trim();
  const result = await db.execute({
    sql: "INSERT INTO words (word, status, added_at) VALUES (?, 'pending', ?)",
    args: [clean, now],
  });
  return { id: Number(result.lastInsertRowid), word: clean, status: "pending", character_id: null, added_at: now, produced_at: null };
}

export async function addWordsFromCsv(words: string[]): Promise<{ added: number; duplicates: number }> {
  const db = await ensureMigrated();
  let added = 0;
  let duplicates = 0;
  const now = Date.now();

  const stmts: InStatement[] = [];
  const cleanWords = words.map((w) => w.toLowerCase().trim()).filter(Boolean);

  // Use batch for efficiency
  for (const clean of cleanWords) {
    stmts.push({
      sql: "INSERT OR IGNORE INTO words (word, status, added_at) VALUES (?, 'pending', ?)",
      args: [clean, now],
    });
  }

  const results = await db.batch(stmts, "write");
  for (const r of results) {
    if (r.rowsAffected > 0) added++;
    else duplicates++;
  }

  return { added, duplicates };
}

export async function markWordProduced(word: string, characterId?: string): Promise<void> {
  const db = await ensureMigrated();
  await db.execute({
    sql: "UPDATE words SET status = 'produced', produced_at = ?, character_id = ? WHERE LOWER(word) = LOWER(?)",
    args: [Date.now(), characterId ?? null, word],
  });
}

export async function markWordPending(word: string): Promise<void> {
  const db = await ensureMigrated();
  await db.execute({
    sql: "UPDATE words SET status = 'pending', produced_at = NULL, character_id = NULL WHERE LOWER(word) = LOWER(?)",
    args: [word],
  });
}

export async function deleteWord(word: string): Promise<void> {
  const db = await ensureMigrated();
  await db.execute({ sql: "DELETE FROM words WHERE LOWER(word) = LOWER(?)", args: [word] });
}

export async function scriptExistsForWord(word: string): Promise<boolean> {
  const db = await ensureMigrated();
  const result = await db.execute({ sql: "SELECT id FROM scripts WHERE LOWER(word) = LOWER(?) LIMIT 1", args: [word] });
  return result.rows.length > 0;
}

export async function getUploadedWordsList(): Promise<string[]> {
  const db = await ensureMigrated();
  const result = await db.execute(
    `SELECT DISTINCT LOWER(REPLACE(REPLACE(filename, '.mp4', ''), 'word_', '')) as word
     FROM metadata_history WHERE status = 'uploaded'`
  );
  return result.rows.map((r) => String(r.word));
}

export async function getScriptedWords(): Promise<string[]> {
  const db = await ensureMigrated();
  const result = await db.execute("SELECT DISTINCT LOWER(word) as word FROM scripts");
  return result.rows.map((r) => String(r.word));
}

/* ------------------------------------------------------------------ */
/*  Sight Word Seeder                                                  */
/* ------------------------------------------------------------------ */

export async function seedSightWords(): Promise<{ added: number; duplicates: number }> {
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
