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

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (key !== process.env.DASHBOARD_ACCESS_KEY) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const daysParam = request.nextUrl.searchParams.get("days");
  const days = daysParam ? parseInt(daysParam, 10) : 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  try {
    const oauth2Client = createAuthClient();
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // Get channel's uploads playlist
    const channelRes = await youtube.channels.list({
      part: ["contentDetails"],
      mine: true,
    });

    const uploadsPlaylistId =
      channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      return NextResponse.json({ error: "No uploads playlist found" }, { status: 404 });
    }

    // Fetch all recent playlist items (up to 150 for broad coverage)
    let allVideoIds: string[] = [];
    let nextPageToken: string | undefined;
    let pages = 0;

    do {
      const playlistRes = await youtube.playlistItems.list({
        part: ["snippet"],
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: nextPageToken,
      });

      const items = playlistRes.data.items ?? [];
      const ids = items
        .map((item) => item.snippet?.resourceId?.videoId)
        .filter(Boolean) as string[];

      allVideoIds = allVideoIds.concat(ids);
      nextPageToken = playlistRes.data.nextPageToken ?? undefined;
      pages++;

      // Stop paginating if oldest item in this batch is older than cutoff
      const oldest = items[items.length - 1]?.snippet?.publishedAt;
      if (oldest && new Date(oldest) < cutoffDate) break;
    } while (nextPageToken && pages < 10); // Allow more pages for larger ranges

    // Fetch full video details in batches of 50
    interface VideoInfo {
      id: string;
      title: string;
      thumbnail: string;
      publishedAt: string;
      scheduledAt: string | null;
      privacy: string;
      status: "published" | "unlisted" | "scheduled" | "private";
      duration: number;
      isShort: boolean;
      views: number;
      word: string;
    }

    const videos: VideoInfo[] = [];

    for (let i = 0; i < allVideoIds.length; i += 50) {
      const batch = allVideoIds.slice(i, i + 50);
      const detailsRes = await youtube.videos.list({
        part: ["snippet", "status", "contentDetails", "statistics"],
        id: batch,
      });

      for (const item of detailsRes.data.items ?? []) {
        const privacy = item.status?.privacyStatus ?? "private";
        const publishAt = item.status?.publishAt ?? null;

        // Parse duration
        const dur = item.contentDetails?.duration ?? "PT0S";
        const dm = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const totalSec =
          (parseInt(dm?.[1] ?? "0") * 3600) +
          (parseInt(dm?.[2] ?? "0") * 60) +
          parseInt(dm?.[3] ?? "0");

        // Extract word from title (e.g., "Kindergarten Sight Words: run | ..." → "run")
        const titleMatch = item.snippet?.title?.match(/Sight Words?:\s*(\w+)/i);
        const word = titleMatch?.[1]?.toLowerCase() ?? "";

        // Determine status
        let videoStatus: VideoInfo["status"];
        if (privacy === "public") {
          videoStatus = "published";
        } else if (publishAt) {
          videoStatus = "scheduled";
        } else if (privacy === "unlisted") {
          videoStatus = "unlisted";
        } else {
          videoStatus = "private";
        }

        videos.push({
          id: item.id!,
          title: item.snippet?.title ?? "Unknown",
          thumbnail:
            item.snippet?.thumbnails?.medium?.url ??
            item.snippet?.thumbnails?.default?.url ??
            "",
          publishedAt: item.snippet?.publishedAt ?? "",
          scheduledAt: publishAt,
          privacy,
          status: videoStatus,
          duration: totalSec,
          isShort: totalSec <= 60,
          views: parseInt(item.statistics?.viewCount ?? "0", 10),
          word,
        });
      }
    }

    // Filter by date range (always include unlisted and scheduled regardless of date)
    const filteredVideos = videos.filter((v) => {
      if (v.status === "unlisted" || v.status === "scheduled") return true;
      return new Date(v.publishedAt) >= cutoffDate;
    });

    // Sort: scheduled first (by date), then unlisted, then published (newest first)
    filteredVideos.sort((a, b) => {
      const order = { scheduled: 0, unlisted: 1, published: 2, private: 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      if (a.status === "scheduled" && b.status === "scheduled") {
        return new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime();
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    // Stats
    const stats = {
      unlisted: filteredVideos.filter((v) => v.status === "unlisted").length,
      scheduled: filteredVideos.filter((v) => v.status === "scheduled").length,
      publishedThisMonth: filteredVideos.filter((v) => {
        if (v.status !== "published") return false;
        const pub = new Date(v.publishedAt);
        const now = new Date();
        return pub.getMonth() === now.getMonth() && pub.getFullYear() === now.getFullYear();
      }).length,
      total: filteredVideos.length,
    };

    return NextResponse.json({ videos: filteredVideos, stats, days });
  } catch (error: unknown) {
    console.error("Production API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
