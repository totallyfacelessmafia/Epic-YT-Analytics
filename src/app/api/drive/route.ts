import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAllMetadata } from "@/lib/db";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const folderId = request.nextUrl.searchParams.get("folderId");

  if (key !== process.env.DASHBOARD_ACCESS_KEY) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!folderId) {
    return NextResponse.json({ error: "folderId is required" }, { status: 400 });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='video/mp4' and trashed=false`,
      fields: "files(id,name,size,createdTime,thumbnailLink)",
      orderBy: "createdTime desc",
      pageSize: 50,
    });

    // Get upload history from DB
    let uploadedMap: Record<string, { youtube_url: string | null; youtube_id: string | null; title: string; description: string; tags: string; created_at: number }> = {};
    try {
      const allMetadata = getAllMetadata();
      for (const m of allMetadata) {
        if (m.status === "uploaded" && m.drive_file_id) {
          uploadedMap[m.drive_file_id] = {
            youtube_url: m.youtube_url,
            youtube_id: m.youtube_id,
            title: m.title,
            description: m.description,
            tags: m.tags,
            created_at: m.created_at,
          };
        }
      }
    } catch {
      // DB not available (e.g. on Vercel), continue without upload history
    }

    const files = (res.data.files ?? []).map((f) => {
      const uploaded = uploadedMap[f.id!];
      return {
        id: f.id,
        name: f.name,
        size: Number(f.size ?? 0),
        createdTime: f.createdTime,
        thumbnail: f.thumbnailLink ?? null,
        ...(uploaded ? {
          uploaded: true,
          youtubeUrl: uploaded.youtube_url,
          youtubeId: uploaded.youtube_id,
          title: uploaded.title,
          description: uploaded.description,
          tags: JSON.parse(uploaded.tags || "[]"),
          uploadedAt: new Date(uploaded.created_at).toISOString(),
        } : {}),
      };
    });

    return NextResponse.json({ files });
  } catch (error: unknown) {
    console.error("Drive API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
