import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";
import { updateMetadataUpload } from "@/lib/db";

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
        // Create a fresh Drive client for the move operation
        const moveAuth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        moveAuth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        const moveDrive = google.drive({ version: "v3", auth: moveAuth });

        // Check if "UPLOADED" folder already exists
        const folderSearch = await moveDrive.files.list({
          q: `'${sourceFolderId}' in parents and name='UPLOADED' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id)",
        });

        let uploadedFolderId: string;

        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
          uploadedFolderId = folderSearch.data.files[0].id!;
        } else {
          // Create the "UPLOADED" folder
          const newFolder = await moveDrive.files.create({
            requestBody: {
              name: "UPLOADED",
              mimeType: "application/vnd.google-apps.folder",
              parents: [sourceFolderId],
            },
            fields: "id",
          });
          uploadedFolderId = newFolder.data.id!;
        }

        console.log(`Copying file ${driveFileId} to UPLOADED folder ${uploadedFolderId}`);

        // Get original file name
        const originalFile = await moveDrive.files.get({
          fileId: driveFileId,
          fields: "name",
        });

        // Copy file to UPLOADED folder
        // Note: Cannot delete/move originals owned by another user (e.g. carlos@getepic.com)
        // so we copy instead and track upload status in the database
        await moveDrive.files.copy({
          fileId: driveFileId,
          requestBody: {
            name: originalFile.data.name!,
            parents: [uploadedFolderId],
          },
          fields: "id",
        });

        console.log(`File copied to UPLOADED folder successfully.`);
      } catch (moveErr: unknown) {
        const msg = moveErr instanceof Error ? moveErr.message : "Unknown";
        const details = (moveErr as { response?: { data?: unknown } })?.response?.data;
        console.error("Failed to move file to UPLOADED folder:", msg, details);
      }
    }

    const youtubeUrl = `https://youtube.com/watch?v=${uploadRes.data.id}`;

    // Update database with upload info
    try {
      updateMetadataUpload(driveFileId, youtubeUrl, uploadRes.data.id!);
    } catch (dbErr) {
      console.error("DB update error (non-fatal):", dbErr);
    }

    return NextResponse.json({
      videoId: uploadRes.data.id,
      title: uploadRes.data.snippet?.title,
      url: youtubeUrl,
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
