import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (key !== process.env.DASHBOARD_ACCESS_KEY) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { filename, driveFileId } = await request.json();

  if (!filename) {
    return NextResponse.json({ error: "filename is required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are an advanced YouTube SEO specialist for children's educational content, optimized for YouTube's 2026 Intent Clustering algorithm.

Based on this video filename, generate YouTube metadata in the "Kitten Ninja by Epic" style.

Filename: "${filename}"

RULES:

1. POWER TITLE (under 100 characters):
   - The primary keyword MUST appear in the first 40 characters (critical for mobile truncation).
   - Use this formula: Kindergarten Sight Words: [WORD] | Kitten Ninja By Epic
   - If the filename suggests a different educational topic (not a sight word), adapt the formula but keep the keyword front-loaded.
   - Do NOT include any emojis in the title. Keep it clean and professional.

2. AI-PROOF DESCRIPTION:
   YouTube's internal AI and LLMs scan the first 2 lines for categorization. Structure EXACTLY like this:

   Line 1: 🌟 Master the sight word "[WORD]" with Kitten Ninja! This quick lesson helps kindergarteners and preschoolers recognize high-frequency words through fun ninja action.

   Line 2 (blank line)

   Line 3: ✨ Start reading for free at getepic.com

   Line 4 (blank line)

   Lines 5-7:
   Word of the Day: [word]
   Category: Reading & Literacy
   Level: Kindergarten / Preschool

   Line 8 (blank line)

   Lines 9-11:
   ABOUT KITTEN NINJA:
   Kitten Ninja makes learning sight words fun with quick, action-packed videos that help early readers build confidence. Part of the Epic Originals library — trusted by teachers and loved by kids.

   Line 12 (blank line)

   Lines 13-16:
   🛡️ ABOUT EPIC
   Epic is the leading digital reading platform for kids 12 and under! Our mission is to inspire the next generation to develop a love of reading and learning. Used in over 90% of U.S. elementary schools, Epic provides a safe, high-quality digital library of 40,000+ books, videos, and quizzes.

   Line 17 (blank line)

   Line 18: #SightWords #LearnToRead #KittenNinja #EpicKids #EarlyLiteracy #Phonics #KindergartenReading

3. TAGS (3 clusters, 15-20 total):
   Cluster A — Brand: Epic Kids, Kitten Ninja, GetEpic, Epic Originals, Epic Reading
   Cluster B — Educational Intent: Learn to read, Phonics for kids, Sight words kindergarten, Early literacy, High frequency words, Reading for beginners, Preschool reading
   Cluster C — Content Type: Word of the Day, Educational shorts, Kids learning videos, Nursery rhymes alternative, Learn sight words

Return ONLY valid JSON in this exact format:
{
  "title": "the power title",
  "description": "the full description with line breaks as \\n",
  "tags": ["array of 15-20 tags from all 3 clusters"]
}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const metadata = JSON.parse(cleaned);

    // Save to database
    if (driveFileId) {
      try {
        const { createMetadata } = await import("@/lib/db");
        await createMetadata({
          drive_file_id: driveFileId,
          filename,
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags || [],
        });
      } catch (dbErr) {
        console.error("DB save error (non-fatal):", dbErr);
      }
    }

    return NextResponse.json(metadata);
  } catch (error: unknown) {
    console.error("Claude API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
