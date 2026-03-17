import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

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

    const files = (res.data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      size: Number(f.size ?? 0),
      createdTime: f.createdTime,
      thumbnail: f.thumbnailLink ?? null,
    }));

    return NextResponse.json({ files });
  } catch (error: unknown) {
    console.error("Drive API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
