import { NextRequest, NextResponse } from "next/server";

function auth(req: NextRequest) {
  return req.nextUrl.searchParams.get("key") === process.env.DASHBOARD_ACCESS_KEY;
}

// GET /api/scripts — list all saved scripts
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { getAllScripts, getScriptsByCharacter } = await import("@/lib/db");

    const characterId = req.nextUrl.searchParams.get("characterId");
    const rows = characterId ? await getScriptsByCharacter(characterId) : await getAllScripts();
    const scripts = rows.map((r) => ({
      id: r.id,
      word: r.word,
      characterId: r.character_id,
      characterName: r.character_name,
      setting: r.setting,
      background: r.background,
      script: r.script,
      narratorLines: JSON.parse(r.narrator_lines),
      negativePrompt: r.negative_prompt,
      colorCategory: r.color_category,
      bgColor: r.bg_color,
      generatedAt: r.generated_at,
    }));
    return NextResponse.json({ scripts });
  } catch (err) {
    console.error("GET /api/scripts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/scripts — save, delete, or clear scripts
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { createScript, deleteScript, clearAllScripts } = await import("@/lib/db");

    const body = await req.json();

    if (body.action === "delete") {
      await deleteScript(body.id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "clear") {
      await clearAllScripts();
      return NextResponse.json({ ok: true });
    }

    // Default: save a script
    const s = body.script;
    if (!s || !s.id || !s.word) {
      return NextResponse.json({ error: "script data required" }, { status: 400 });
    }

    await createScript({
      id: s.id,
      word: s.word,
      character_id: s.characterId,
      character_name: s.characterName,
      setting: s.setting || "",
      background: s.background || "",
      script: s.script || "",
      narrator_lines: JSON.stringify(s.narratorLines || []),
      negative_prompt: s.negativePrompt || "",
      color_category: s.colorCategory || "",
      bg_color: s.bgColor || "",
      generated_at: s.generatedAt,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/scripts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
