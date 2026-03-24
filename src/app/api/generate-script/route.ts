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

  const { word, characterName, visualDna, textColor } = await request.json();

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

    const colorName = textColor || 'green';

    const prompt = `You are an expert animation script writer for children's educational Shorts. You write single continuous 15-second vertical 9:16 animation prompts for a "Word of the Day" series starring ${characterName}.

Your prompts are HIGHLY SPECIFIC and VISUAL — you describe exact props, exact movements, exact sound effects, and exact choreography. Think like a Pixar storyboard artist writing for preschoolers.

REFERENCE EXAMPLE (for the word "catch" in ${colorName} text):
"A large and thick lowercase ${colorName} word 'catch' with a dark outline appears on the lavender wall. Kitten Ninja stands ready on the tan floor, arms outstretched like he's waiting for a hug. A soft 'Whirr' sound plays as a large, bright pink frosted donut with sprinkles floats into the frame from the left like a frisbee. The narrator says: 'Today's word of the day is... catch!'

Kitten Ninja gets a determined look (tilted head). He tracks the donut with his dot eyes. Just as the donut reaches him, he leaps into the air and 'catches' it. However, instead of grabbing it with his paws, the donut lands perfectly around his middle like a hula hoop! A 'Slide-whistle' sound plays as he spins around once in the air. The narrator says: 'Got it! Kitten Ninja can really catch!'

Kitten Ninja lands on his feet with the donut still around his waist. He looks down at his new 'donut belt' and gives a big thumbs up to the camera.

FINALE: Kitten Ninja strikes a heroic pose. The ${colorName} word catch pulses and glows on the lavender wall. Tiny sprinkle icons and white stars rain down. The narrator says: 'Nice hands! That is catch!'"

NOW WRITE A PROMPT LIKE THIS FOR THE WORD "${word}".

STRICT RULES:
- CHARACTER: ${characterName} — ${visualDna}
- KITTEN NINJA DOES NOT SPEAK. Ever. No dialogue, no speech bubbles, no lip-syncing.
- EYES: Solid black dots only. No blinking, no white in the eyes.
- MOUTH: Static "u" shaped sticker. NO movement.
- ENVIRONMENT: Lavender wall (top half) and tan floor (bottom half). NOTHING ELSE.
- The word "${word}" is displayed on the lavender wall in all lowercase ${colorName} letters. No capital letters.
- NO on-screen captions or subtitles. The ONLY visual text is the word "${word}" on the wall.
- NO sharp objects, swords, or weapons. Keep it safe for preschool/kindergarten.
- Include specific SOUND EFFECTS (whoosh, boing, slide-whistle, etc.)
- The PROP must be a specific, colorful, fun object that relates to the word — not generic.
- The NARRATOR lines must be playful and kid-friendly, with a fun closing pun or wordplay.

NARRATOR LINES (offscreen only):
- Line 1 (0s): "Today's word of the day is... ${word}!"
- Line 2 (~6s): A fun encouragement/setup line about the action.
- Line 3 (~13s): A playful closing line with a pun or wordplay using "${word}".

Return ONLY valid JSON in this exact format:
{
  "word": "${word}",
  "setting": "Lavender Dojo",
  "background": "${STANDARD_BACKGROUND}",
  "script": "The complete animation prompt as a single continuous paragraph. Be SPECIFIC about props, movements, sounds, and choreography. Under 400 words.",
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

    // Robust JSON parsing — fix common issues like unescaped quotes in script text
    let script;
    try {
      script = JSON.parse(cleaned);
    } catch {
      // Try to fix unescaped quotes inside string values
      const fixed = cleaned.replace(/"script"\s*:\s*"([\s\S]*?)"\s*,\s*"narratorLines/,
        (match, scriptContent) => {
          const escaped = scriptContent
            .replace(/(?<!\\)"/g, '\\"')
            .replace(/\n/g, '\\n');
          return `"script": "${escaped}", "narratorLines`;
        }
      );
      try {
        script = JSON.parse(fixed);
      } catch {
        // Last resort: extract fields manually
        const wordMatch = cleaned.match(/"word"\s*:\s*"([^"]+)"/);
        const scriptMatch = cleaned.match(/"script"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"narrator|"\s*})/);
        script = {
          word: wordMatch?.[1] ?? word,
          setting: "Lavender Dojo",
          background: STANDARD_BACKGROUND,
          script: scriptMatch?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"') ?? cleaned,
          narratorLines: [
            { time: "0s", line: `Today's word of the day is... ${word}!` },
            { time: "~6s", line: "" },
            { time: "~13s", line: "" },
          ],
          negativePrompt: NEGATIVE_PROMPT_BASE,
        };
      }
    }

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
