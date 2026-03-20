import { NextRequest, NextResponse } from "next/server";

function auth(req: NextRequest) {
  return req.nextUrl.searchParams.get("key") === process.env.DASHBOARD_ACCESS_KEY;
}

// GET /api/words — list words, optionally filtered by status and character
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { getWordsByCharacter, getAllWords, getPendingWords, getProducedWords } = await import("@/lib/db");

    const status = req.nextUrl.searchParams.get("status");
    const characterId = req.nextUrl.searchParams.get("characterId");

    let rows;
    if (characterId) {
      rows = await getWordsByCharacter(characterId);
      if (status) rows = rows.filter((r) => r.status === status);
    } else if (status === "pending") rows = await getPendingWords();
    else if (status === "produced") rows = await getProducedWords();
    else rows = await getAllWords();

    const words = rows.map((r) => ({
      id: r.id,
      word: r.word,
      status: r.status,
      characterId: r.character_id,
      addedAt: r.added_at,
      producedAt: r.produced_at,
    }));

    return NextResponse.json({ words });
  } catch (err) {
    console.error("GET /api/words error:", err);
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}

// POST /api/words — add, import CSV, mark produced/pending, delete, or check duplicate
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const {
      addWord,
      addWordsFromCsv,
      markWordProduced,
      markWordPending,
      deleteWord,
      scriptExistsForWord,
      seedSightWords,
    } = await import("@/lib/db");

    const body = await req.json();
    const characterId = body.characterId || "kitten-ninja";

    // Seed Dolch/Fry kindergarten sight words
    if (body.action === "seed") {
      const result = await seedSightWords(characterId);
      return NextResponse.json(result);
    }

    // Check if a word already has a script for this character
    if (body.action === "check") {
      const word = (body.word || "").toLowerCase().trim();
      if (!word) return NextResponse.json({ error: "word required" }, { status: 400 });
      const hasScript = await scriptExistsForWord(word, characterId);
      return NextResponse.json({ word, hasScript });
    }

    // Import multiple words from CSV text
    if (body.action === "import") {
      const rawWords: string[] = (body.words || "")
        .split(/[\n,;]+/)
        .map((w: string) => w.trim().toLowerCase())
        .filter(Boolean);

      if (rawWords.length === 0) {
        return NextResponse.json({ error: "No words provided" }, { status: 400 });
      }

      const result = await addWordsFromCsv(rawWords, characterId);
      return NextResponse.json(result);
    }

    // Mark a word as produced
    if (body.action === "produce") {
      await markWordProduced(body.word, characterId);
      return NextResponse.json({ ok: true });
    }

    // Mark a word back to pending
    if (body.action === "unproduce") {
      await markWordPending(body.word, characterId);
      return NextResponse.json({ ok: true });
    }

    // Delete a word
    if (body.action === "delete") {
      await deleteWord(body.word, characterId);
      return NextResponse.json({ ok: true });
    }

    // Default: add a single word
    const word = (body.word || "").toLowerCase().trim();
    if (!word) return NextResponse.json({ error: "word required" }, { status: 400 });

    const result = await addWord(word, characterId);
    if (!result) {
      return NextResponse.json({ error: "duplicate", message: `"${word}" already exists for this character!` }, { status: 409 });
    }

    return NextResponse.json({
      word: { id: result.id, word: result.word, status: result.status, characterId: result.character_id, addedAt: result.added_at },
    });
  } catch (err) {
    console.error("POST /api/words error:", err);
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
