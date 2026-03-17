import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";

export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (key !== process.env.DASHBOARD_ACCESS_KEY) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { driveFileId, title, description, tags, sourceFolderId } = await request.json();

  if (!driveFileId || !title || !description) {
    return NextResponse.json(
      { error: "driveFileId, title, and description are required" },
      { status: 400 }
    );
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
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // Download the video from Google Drive
    const driveRes = await drive.files.get(
      { fileId: driveFileId, alt: "media" },
      { responseType: "stream" }
    );

    // Upload to YouTube
    const uploadRes = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title,
          description,
          tags: tags ?? [],
          categoryId: "27", // Education
        },
        status: {
          privacyStatus: "unlisted",
          selfDeclaredMadeForKids: true,
        },
      },
      media: {
        mimeType: "video/mp4",
        body: driveRes.data as Readable,
      },
    });

    // Move the file to an "UPLOADED" subfolder in the source Drive folder
    if (sourceFolderId) {
      try {
        // Check if "UPLOADED" folder already exists
        const folderSearch = await drive.files.list({
          q: `'${sourceFolderId}' in parents and name='UPLOADED' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id)",
        });

        let uploadedFolderId: string;

        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
          uploadedFolderId = folderSearch.data.files[0].id!;
        } else {
          // Create the "UPLOADED" folder
          const newFolder = await drive.files.create({
            requestBody: {
              name: "UPLOADED",
              mimeType: "application/vnd.google-apps.folder",
              parents: [sourceFolderId],
            },
            fields: "id",
          });
          uploadedFolderId = newFolder.data.id!;
        }

        // Move the file: remove from source folder, add to UPLOADED folder
        await drive.files.update({
          fileId: driveFileId,
          addParents: uploadedFolderId,
          removeParents: sourceFolderId,
          fields: "id",
        });
      } catch (moveErr) {
        // Log but don't fail the upload if the move fails
        console.error("Failed to move file to UPLOADED folder:", moveErr);
      }
    }

    return NextResponse.json({
      videoId: uploadRes.data.id,
      title: uploadRes.data.snippet?.title,
      url: `https://youtube.com/watch?v=${uploadRes.data.id}`,
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
