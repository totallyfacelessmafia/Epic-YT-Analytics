import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

function createAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return oauth2Client;
}

export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (key !== process.env.DASHBOARD_ACCESS_KEY) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { videoId, publishAt, action } = await request.json();

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  try {
    const oauth2Client = createAuthClient();
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    if (action === "publish-now") {
      // Make public immediately
      await youtube.videos.update({
        part: ["status"],
        requestBody: {
          id: videoId,
          status: {
            privacyStatus: "public",
            selfDeclaredMadeForKids: true,
          },
        },
      });

      return NextResponse.json({ ok: true, status: "published" });
    }

    if (action === "unschedule") {
      // Revert to unlisted (remove scheduled publish date)
      await youtube.videos.update({
        part: ["status"],
        requestBody: {
          id: videoId,
          status: {
            privacyStatus: "unlisted",
            selfDeclaredMadeForKids: true,
          },
        },
      });

      return NextResponse.json({ ok: true, status: "unlisted" });
    }

    // Default: schedule for a specific date/time
    if (!publishAt) {
      return NextResponse.json({ error: "publishAt is required for scheduling" }, { status: 400 });
    }

    // YouTube requires the video to be private with a publishAt date
    await youtube.videos.update({
      part: ["status"],
      requestBody: {
        id: videoId,
        status: {
          privacyStatus: "private",
          publishAt: new Date(publishAt).toISOString(),
          selfDeclaredMadeForKids: true,
        },
      },
    });

    return NextResponse.json({ ok: true, status: "scheduled", publishAt });
  } catch (error: unknown) {
    console.error("Schedule video error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const details = (error as { response?: { data?: unknown } })?.response?.data;
    return NextResponse.json({ error: message, details }, { status: 500 });
  }
}
