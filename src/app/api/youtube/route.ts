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
  const contentFilter = request.nextUrl.searchParams.get("filter") || "all";

  if (key !== process.env.DASHBOARD_ACCESS_KEY) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const oauth2Client = createAuthClient();

    const youtubeAnalytics = google.youtubeAnalytics({
      version: "v2",
      auth: oauth2Client,
    });

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // Get the authenticated user's channel
    const channelRes = await youtube.channels.list({
      part: ["id"],
      mine: true,
    });

    const channelId = channelRes.data.items?.[0]?.id;
    if (!channelId) {
      return NextResponse.json(
        { error: "No channel found" },
        { status: 404 }
      );
    }

    const now = new Date();
    const endDate = now.toISOString().split("T")[0];

    // Last 30 days
    const start30 = new Date(now);
    start30.setDate(start30.getDate() - 30);
    const startDate30 = start30.toISOString().split("T")[0];

    // Previous 30 days (for comparison)
    const start60 = new Date(now);
    start60.setDate(start60.getDate() - 60);
    const startDate60 = start60.toISOString().split("T")[0];

    // Fetch current period daily data, previous period totals, and top videos
    const [currentPeriod, previousPeriod, topVideosReport, searchTermsReport] = await Promise.all([
      youtubeAnalytics.reports.query({
        ids: `channel==${channelId}`,
        startDate: startDate30,
        endDate: endDate,
        metrics: "views,estimatedMinutesWatched,subscribersGained",
        dimensions: "day",
        sort: "day",
      }),
      youtubeAnalytics.reports.query({
        ids: `channel==${channelId}`,
        startDate: startDate60,
        endDate: startDate30,
        metrics: "views,estimatedMinutesWatched,subscribersGained",
      }),
      youtubeAnalytics.reports.query({
        ids: `channel==${channelId}`,
        startDate: startDate30,
        endDate: endDate,
        metrics: "views,averageViewDuration",
        dimensions: "video",
        sort: "-views",
        maxResults: 20,
      }),
      youtubeAnalytics.reports.query({
        ids: `channel==${channelId}`,
        startDate: startDate30,
        endDate: endDate,
        metrics: "views,estimatedMinutesWatched",
        dimensions: "insightTrafficSourceDetail",
        filters: "insightTrafficSourceType==YT_SEARCH",
        sort: "-views",
        maxResults: 20,
      }),
    ]);

    // Parse daily data
    const dailyData = (currentPeriod.data.rows ?? []).map((row) => ({
      date: row[0] as string,
      views: row[1] as number,
      watchTime: row[2] as number,
      subscribers: row[3] as number,
    }));

    // Calculate totals for current period
    const currentTotals = dailyData.reduce(
      (acc, day) => ({
        views: acc.views + day.views,
        watchTime: acc.watchTime + day.watchTime,
        subscribers: acc.subscribers + day.subscribers,
      }),
      { views: 0, watchTime: 0, subscribers: 0 }
    );

    // Previous period totals
    const prevRow = previousPeriod.data.rows?.[0];
    const previousTotals = prevRow
      ? {
          views: prevRow[0] as number,
          watchTime: prevRow[1] as number,
          subscribers: prevRow[2] as number,
        }
      : { views: 0, watchTime: 0, subscribers: 0 };

    // Percentage change helper
    const pctChange = (current: number, previous: number) =>
      previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

    // Get video IDs from top videos report
    const topVideoRows = topVideosReport.data.rows ?? [];
    const videoIds = topVideoRows.map((row) => row[0] as string);

    // Fetch video details (title, thumbnail, duration) from Data API v3
    let topVideos: {
      id: string;
      title: string;
      thumbnail: string;
      views: number;
      avgViewDuration: number;
      isShort: boolean;
    }[] = [];

    if (videoIds.length > 0) {
      const videoDetails = await youtube.videos.list({
        part: ["snippet", "contentDetails"],
        id: videoIds,
      });

      const detailsMap = new Map(
        (videoDetails.data.items ?? []).map((item) => [item.id!, item])
      );

      topVideos = topVideoRows.map((row) => {
        const videoId = row[0] as string;
        const detail = detailsMap.get(videoId);
        const duration = detail?.contentDetails?.duration ?? "PT0S";

        // Parse ISO 8601 duration to seconds
        const durationMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const totalSeconds =
          (parseInt(durationMatch?.[1] ?? "0") * 3600) +
          (parseInt(durationMatch?.[2] ?? "0") * 60) +
          parseInt(durationMatch?.[3] ?? "0");

        return {
          id: videoId,
          title: detail?.snippet?.title ?? "Unknown",
          thumbnail:
            detail?.snippet?.thumbnails?.medium?.url ??
            detail?.snippet?.thumbnails?.default?.url ??
            "",
          views: row[1] as number,
          avgViewDuration: row[2] as number,
          isShort: totalSeconds <= 60,
        };
      });
    }

    // Filter videos by content type
    let filteredTopVideos = topVideos;
    if (contentFilter === "shorts") {
      filteredTopVideos = topVideos.filter((v) => v.isShort);
    } else if (contentFilter === "long") {
      filteredTopVideos = topVideos.filter((v) => !v.isShort);
    }

    // Upload frequency: count videos published this week, last week, and last 30 days
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    // Use the channel's uploads playlist to count videos by date range
    const channelDetails = await youtube.channels.list({
      part: ["contentDetails"],
      id: [channelId],
    });
    const uploadsPlaylistId =
      channelDetails.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    let uploadCounts = { thisWeek: 0, lastWeek: 0, last30Days: 0 };
    let unlistedCounts = { today: 0, thisWeek: 0, lastWeek: 0 };
    let allItems: { publishedAt: string; videoId: string }[] = [];

    if (uploadsPlaylistId) {
      // Fetch up to 50 recent playlist items (covers last 30 days for most channels)
      let nextPageToken: string | undefined;

      do {
        const playlistRes = await youtube.playlistItems.list({
          part: ["snippet"],
          playlistId: uploadsPlaylistId,
          maxResults: 50,
          pageToken: nextPageToken,
        });

        const items = (playlistRes.data.items ?? []).map((item) => ({
          publishedAt: item.snippet?.publishedAt ?? "",
          videoId: item.snippet?.resourceId?.videoId ?? "",
        }));
        allItems = allItems.concat(items);
        nextPageToken = playlistRes.data.nextPageToken ?? undefined;

        // Stop paginating if the oldest item in this batch is older than 30 days
        const oldest = items[items.length - 1]?.publishedAt;
        if (oldest && new Date(oldest) < start30) break;
      } while (nextPageToken);

      // Count total uploads by period
      for (const item of allItems) {
        const pubDate = new Date(item.publishedAt);
        if (pubDate >= start30) uploadCounts.last30Days++;
        if (pubDate >= startOfThisWeek) uploadCounts.thisWeek++;
        if (pubDate >= startOfLastWeek && pubDate < startOfThisWeek) uploadCounts.lastWeek++;
      }

      // Get video IDs from last 30 days to check privacy status
      const recentVideoIds = allItems
        .filter((item) => new Date(item.publishedAt) >= startOfLastWeek && item.videoId)
        .map((item) => item.videoId);

      if (recentVideoIds.length > 0) {
        // Fetch in batches of 50
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < recentVideoIds.length; i += 50) {
          const batch = recentVideoIds.slice(i, i + 50);
          const statusRes = await youtube.videos.list({
            part: ["status", "snippet"],
            id: batch,
          });

          for (const video of statusRes.data.items ?? []) {
            if (video.status?.privacyStatus === "unlisted") {
              const pubDate = new Date(video.snippet?.publishedAt ?? "");
              if (pubDate >= today) unlistedCounts.today++;
              if (pubDate >= startOfThisWeek) unlistedCounts.thisWeek++;
              if (pubDate >= startOfLastWeek && pubDate < startOfThisWeek) unlistedCounts.lastWeek++;
            }
          }
        }
      }
    }

    // Parse top search terms
    const searchTerms = (searchTermsReport.data.rows ?? []).map((row) => ({
      term: row[0] as string,
      views: row[1] as number,
      watchTime: row[2] as number,
    }));

    // ── NEW: CTR + Impressions per video ──
    let ctrData: { videoId: string; title: string; thumbnail: string; impressions: number; ctr: number; views: number; isShort: boolean }[] = [];
    try {
      const ctrReport = await youtubeAnalytics.reports.query({
        ids: `channel==${channelId}`,
        startDate: startDate30,
        endDate: endDate,
        metrics: "views,impressions,impressionClickThroughRate",
        dimensions: "video",
        sort: "-impressions",
        maxResults: 20,
      });

      const ctrRows = ctrReport.data.rows ?? [];
      const ctrVideoIds = ctrRows.map((row) => row[0] as string);

      if (ctrVideoIds.length > 0) {
        const ctrVideoDetails = await youtube.videos.list({
          part: ["snippet", "contentDetails"],
          id: ctrVideoIds,
        });
        const ctrDetailsMap = new Map(
          (ctrVideoDetails.data.items ?? []).map((item) => [item.id!, item])
        );

        ctrData = ctrRows.map((row) => {
          const vid = row[0] as string;
          const detail = ctrDetailsMap.get(vid);
          const duration = detail?.contentDetails?.duration ?? "PT0S";
          const dm = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          const totalSec = (parseInt(dm?.[1] ?? "0") * 3600) + (parseInt(dm?.[2] ?? "0") * 60) + parseInt(dm?.[3] ?? "0");

          return {
            videoId: vid,
            title: detail?.snippet?.title ?? "Unknown",
            thumbnail: detail?.snippet?.thumbnails?.default?.url ?? "",
            views: row[1] as number,
            impressions: row[2] as number,
            ctr: row[3] as number, // already a percentage (0-100)
            isShort: totalSec <= 60,
          };
        });
      }
    } catch (ctrErr) {
      console.error("CTR data fetch failed (non-fatal):", ctrErr);
    }

    // ── NEW: Audience retention (average view duration vs video duration) ──
    let retentionData: { videoId: string; title: string; avgViewDuration: number; videoDuration: number; retentionPct: number; views: number; isShort: boolean }[] = [];
    try {
      // Reuse topVideoRows data + video details we already have
      retentionData = topVideos.map((v) => {
        // Get the video detail to find full duration
        const dur = videoIds.includes(v.id) ? v : null;
        // We need the full video duration — fetch from our existing details
        return v;
      }).filter(Boolean).map((v) => {
        return {
          videoId: v.id,
          title: v.title,
          avgViewDuration: v.avgViewDuration,
          videoDuration: 0, // will be filled below
          retentionPct: 0,
          views: v.views,
          isShort: v.isShort,
        };
      });

      // Get full durations for retention calculation
      if (videoIds.length > 0) {
        const retentionDetails = await youtube.videos.list({
          part: ["contentDetails"],
          id: videoIds,
        });

        const durationMap = new Map<string, number>();
        for (const item of retentionDetails.data.items ?? []) {
          const dur = item.contentDetails?.duration ?? "PT0S";
          const dm = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          const secs = (parseInt(dm?.[1] ?? "0") * 3600) + (parseInt(dm?.[2] ?? "0") * 60) + parseInt(dm?.[3] ?? "0");
          durationMap.set(item.id!, secs);
        }

        retentionData = retentionData.map((r) => {
          const fullDuration = durationMap.get(r.videoId) ?? 0;
          const pct = fullDuration > 0 ? (r.avgViewDuration / fullDuration) * 100 : 0;
          return { ...r, videoDuration: fullDuration, retentionPct: Math.min(pct, 100) };
        });
      }
    } catch (retErr) {
      console.error("Retention data fetch failed (non-fatal):", retErr);
    }

    // ── NEW: Best posting time (publish hour → avg first-period views) ──
    let postingHeatmap: { hour: number; day: number; avgViews: number; count: number }[] = [];
    try {
      // Use allItems from upload frequency (already fetched above)
      if (uploadsPlaylistId) {
        // Get publish times and map to hour/day buckets
        const hourDayBuckets: Record<string, { totalViews: number; count: number }> = {};

        // Get video stats for recently published videos
        const recentItems = allItems.filter((item) => new Date(item.publishedAt) >= start30 && item.videoId);
        const recentIds = recentItems.map((i) => i.videoId);

        if (recentIds.length > 0) {
          // Get view counts for these videos
          const viewsReport = await youtubeAnalytics.reports.query({
            ids: `channel==${channelId}`,
            startDate: startDate30,
            endDate: endDate,
            metrics: "views",
            dimensions: "video",
            filters: `video==${recentIds.join(",")}`,
          });

          const viewsMap = new Map<string, number>();
          for (const row of viewsReport.data.rows ?? []) {
            viewsMap.set(row[0] as string, row[1] as number);
          }

          for (const item of recentItems) {
            const pubDate = new Date(item.publishedAt);
            const hour = pubDate.getHours();
            const day = pubDate.getDay(); // 0=Sun, 6=Sat
            const key = `${day}-${hour}`;
            const views = viewsMap.get(item.videoId) ?? 0;

            if (!hourDayBuckets[key]) hourDayBuckets[key] = { totalViews: 0, count: 0 };
            hourDayBuckets[key].totalViews += views;
            hourDayBuckets[key].count += 1;
          }
        }

        // Convert to array format
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            const key = `${day}-${hour}`;
            const bucket = hourDayBuckets[key];
            postingHeatmap.push({
              hour,
              day,
              avgViews: bucket ? Math.round(bucket.totalViews / bucket.count) : 0,
              count: bucket?.count ?? 0,
            });
          }
        }
      }
    } catch (heatErr) {
      console.error("Posting heatmap fetch failed (non-fatal):", heatErr);
    }

    return NextResponse.json({
      totals: currentTotals,
      changes: {
        views: pctChange(currentTotals.views, previousTotals.views),
        watchTime: pctChange(currentTotals.watchTime, previousTotals.watchTime),
        subscribers: pctChange(currentTotals.subscribers, previousTotals.subscribers),
      },
      dailyData,
      topVideos: filteredTopVideos.slice(0, 5),
      uploadCounts,
      unlistedCounts,
      searchTerms,
      ctrData,
      retentionData,
      postingHeatmap,
    });
  } catch (error: unknown) {
    console.error("YouTube API error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";
    const details =
      (error as { response?: { data?: unknown } })?.response?.data ?? null;
    return NextResponse.json(
      { error: "Failed to fetch analytics data", message, details },
      { status: 500 }
    );
  }
}
