import { NextRequest, NextResponse } from "next/server";
import { getAllMetadata, createMetadata, updateMetadataUpload } from "@/lib/db";

function auth(req: NextRequest) {
  return req.nextUrl.searchParams.get("key") === process.env.DASHBOARD_ACCESS_KEY;
}

// GET /api/metadata-history — list all generated metadata
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = getAllMetadata();
  const history = rows.map((r) => ({
    id: r.id,
    driveFileId: r.drive_file_id,
    filename: r.filename,
    title: r.title,
    description: r.description,
    tags: JSON.parse(r.tags),
    youtubeUrl: r.youtube_url,
    youtubeId: r.youtube_id,
    status: r.status,
    createdAt: r.created_at,
  }));
  return NextResponse.json({ history });
}

// POST /api/metadata-history — save or update metadata
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if (body.action === "upload") {
    // Mark a metadata entry as uploaded
    updateMetadataUpload(body.driveFileId, body.youtubeUrl, body.youtubeId);
    return NextResponse.json({ ok: true });
  }

  // Default: save new metadata
  if (!body.driveFileId || !body.filename || !body.title) {
    return NextResponse.json({ error: "driveFileId, filename, and title required" }, { status: 400 });
  }

  const entry = createMetadata({
    drive_file_id: body.driveFileId,
    filename: body.filename,
    title: body.title,
    description: body.description || "",
    tags: body.tags || [],
  });

  return NextResponse.json({ entry: { id: entry.id } });
}
