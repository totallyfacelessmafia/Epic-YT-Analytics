import { NextRequest, NextResponse } from "next/server";

function auth(req: NextRequest) {
  return req.nextUrl.searchParams.get("key") === process.env.DASHBOARD_ACCESS_KEY;
}

// GET /api/words — list words, optionally filtered by status
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { getAllWords, getPendingWords, getProducedWords } = await import("@/lib/db");

    const status = req.nextUrl.searchParams.get("status");

    let rows;
    if (status === "pending") rows = await getPendingWords();
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
      getScriptedWords,
      getUploadedWordsList,
    } = await import("@/lib/db");

    const body = await req.json();

    // Seed Dolch/Fry kindergarten sight words
    if (body.action === "seed") {
      const result = await seedSightWords();
      return NextResponse.json(result);
    }

    // Get cross-reference data (scripted + uploaded words)
    if (body.action === "crossref") {
      const scripted = await getScriptedWords();
      const uploaded = await getUploadedWordsList();
      return NextResponse.json({ scripted, uploaded });
    }

    // Check if a word already has a script (duplicate detection)
    if (body.action === "check") {
      const word = (body.word || "").toLowerCase().trim();
      if (!word) return NextResponse.json({ error: "word required" }, { status: 400 });
      const hasScript = await scriptExistsForWord(word);
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

      const result = await addWordsFromCsv(rawWords);
      return NextResponse.json(result);
    }

    // Mark a word as produced
    if (body.action === "produce") {
      await markWordProduced(body.word, body.characterId);
      return NextResponse.json({ ok: true });
    }

    // Mark a word back to pending
    if (body.action === "unproduce") {
      await markWordPending(body.word);
      return NextResponse.json({ ok: true });
    }

    // Delete a word
    if (body.action === "delete") {
      await deleteWord(body.word);
      return NextResponse.json({ ok: true });
    }

    // Default: add a single word
    const word = (body.word || "").toLowerCase().trim();
    if (!word) return NextResponse.json({ error: "word required" }, { status: 400 });

    const result = await addWord(word);
    if (!result) {
      return NextResponse.json({ error: "duplicate", message: `"${word}" already exists in the word library!` }, { status: 409 });
    }

    return NextResponse.json({
      word: { id: result.id, word: result.word, status: result.status, addedAt: result.added_at },
    });
  } catch (err) {
    console.error("POST /api/words error:", err);
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
