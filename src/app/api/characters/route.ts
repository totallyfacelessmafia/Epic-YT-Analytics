import { NextRequest, NextResponse } from "next/server";

function auth(req: NextRequest) {
  return req.nextUrl.searchParams.get("key") === process.env.DASHBOARD_ACCESS_KEY;
}

// GET /api/characters — list all characters
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const { getAllCharacters } = await import("@/lib/db");

    const rows = await getAllCharacters();
    const characters = rows.map((r) => ({
      id: r.id,
      name: r.name,
      visualDna: r.visual_dna,
      createdAt: r.created_at,
    }));
    return NextResponse.json({ characters });
  } catch (err) {
    console.error("GET /api/characters error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/characters — create or update a character
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const {
      createCharacter,
      updateCharacter,
      deleteCharacter: removeCharacter,
    } = await import("@/lib/db");

    const body = await req.json();
    const { action, id, name, visualDna } = body;

    if (action === "delete") {
      if (id === "kitten-ninja") {
        return NextResponse.json({ error: "Cannot delete default character" }, { status: 400 });
      }
      await removeCharacter(id);
      return NextResponse.json({ ok: true });
    }

    if (action === "update") {
      if (!id || !visualDna) {
        return NextResponse.json({ error: "id and visualDna required" }, { status: 400 });
      }
      await updateCharacter(id, visualDna);
      return NextResponse.json({ ok: true });
    }

    // Default: create
    if (!id || !name || !visualDna) {
      return NextResponse.json({ error: "id, name, and visualDna required" }, { status: 400 });
    }
    const char = await createCharacter(id, name, visualDna);
    return NextResponse.json({
      character: { id: char.id, name: char.name, visualDna: char.visual_dna, createdAt: char.created_at },
    });
  } catch (err) {
    console.error("POST /api/characters error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
