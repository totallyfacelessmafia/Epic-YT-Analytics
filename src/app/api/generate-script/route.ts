import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getColorMapping } from "@/lib/color-map";

/* ------------------------------------------------------------------ */
/*  Hard-coded environment: Lavender wall / Tan floor                  */
/*  This ensures visual consistency across ALL episodes.               */
/* ------------------------------------------------------------------ */
const STANDARD_BACKGROUND =
  "flat solid soft lavender periwinkle purple wall (top two-thirds) with warm sandy beige tan floor (bottom third). Clean, simple, no patterns, no props except those related to the word.";

/* ------------------------------------------------------------------ */
/*  Hard-coded negative prompt — the "Seedance 2.0 Safeguard"         */
/*  Prevents AI from adding unwanted visual elements.                  */
/* ------------------------------------------------------------------ */
const NEGATIVE_PROMPT_BASE =
  "blinking eyes, moving mouth, open mouth with teeth, tongue, 3D rendering, realistic fur, shading gradients, " +
  "capital letters, on-screen text captions, subtitles, word-of-the-day overlay text, " +
  "speech bubbles, dialogue text, character speaking, character talking, lip sync, " +
  "eyebrows, eyelashes, white sclera, colored iris, realistic eyes, " +
  "multiple characters, human characters, realistic animals, " +
  "dark themes, scary imagery, violence, weapons";

export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  if (key !== process.env.DASHBOARD_ACCESS_KEY) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { word, characterName, visualDna } = await request.json();

  if (!word || !characterName || !visualDna) {
    return NextResponse.json(
      { error: "word, characterName, and visualDna are required" },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  // Color mapping for category tagging (UI display only)
  const colorMapping = getColorMapping(word);

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are an expert animation script writer for children's educational content. You write 15-second vertical (9:16) animation scripts for a "Word of the Day" series.

CHARACTER: ${characterName}
VISUAL DNA (strict rules — never deviate):
${visualDna}

CRITICAL SILENT CHARACTER RULE:
${characterName} NEVER speaks. ${characterName} is completely silent — no dialogue, no speech bubbles, no talking.
Only the OFFSCREEN NARRATOR has spoken lines. ${characterName} communicates ONLY through physical actions, gestures, and facial expressions (within the Visual DNA constraints — remember: static mouth, dot eyes).

ENVIRONMENT (hard-coded — do NOT change):
${STANDARD_BACKGROUND}

WORD: "${word}"

Write a complete 15-second animation script following this EXACT structure:

1. FRAME 1 — THE HOOK (0-3s):
   - ${characterName} enters the 9:16 vertical frame.
   - The word "${word}" MUST be displayed on the lavender wall in large, bold, all lowercase letters with clean black outlines.
   - The character strikes an attention-grabbing pose.

2. THE ACTION (3-10s):
   - ${characterName} performs a "Ninja Mission" that CLEARLY demonstrates the meaning of "${word}".
   - The character interacts with a PHYSICAL OBJECT related to the word.
   - The action must be exaggerated, fun, and unmistakably tied to the word's definition.
   - Include squash-and-stretch cartoon physics.
   - Remember: ${characterName} is SILENT — all expression is through body language.

3. THE FAIL/GAG (10-13s):
   - The mission ends with a small "ninja-fail" or humorous moment.
   - Examples: trying to look cool but tripping, a butterfly landing on their nose, accidentally launching themselves, a prop falling on their head.
   - Keep it gentle and funny — appropriate for preschool/kindergarten viewers.

4. FINALE (13-15s):
   - ${characterName} gives a thumbs up to the physical object.
   - The word "${word}" pulses or glows on the lavender wall.
   - ${characterName} strikes a heroic pose. Colorful confetti or stars celebrate.

NARRATOR LINES (offscreen narrator ONLY — the character NEVER speaks):
- Line 1 (0s): "Today's word of the day is... ${word}!"
- Line 2 (~6s): A setup/encouragement line about the action.
- Line 3 (~13s): A closing celebration line reinforcing the word.

Return ONLY valid JSON in this exact format:
{
  "word": "${word}",
  "setting": "Lavender Dojo",
  "background": "${STANDARD_BACKGROUND}",
  "script": "The complete animation script as a single string with paragraph breaks as \\n\\n. Under 400 words.",
  "narratorLines": [
    {"time": "0s", "line": "Today's word of the day is... ${word}!"},
    {"time": "~6s", "line": "..."},
    {"time": "~13s", "line": "..."}
  ],
  "negativePrompt": "${NEGATIVE_PROMPT_BASE}"
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const script = JSON.parse(cleaned);

    // Force the negative prompt to always include our safeguard base
    if (!script.negativePrompt || !script.negativePrompt.includes("blinking eyes")) {
      script.negativePrompt = NEGATIVE_PROMPT_BASE;
    }

    // Force the background to the standard
    script.background = STANDARD_BACKGROUND;
    script.setting = "Lavender Dojo";

    // Attach color mapping info for UI display
    script.colorCategory = colorMapping.category;
    script.bgColor = colorMapping.cssGradient;

    return NextResponse.json(script);
  } catch (error: unknown) {
    console.error("Script generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
