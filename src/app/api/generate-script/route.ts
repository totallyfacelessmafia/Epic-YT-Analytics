import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  // Rotate settings deterministically based on the word
  const settings = ["Dojo", "Bamboo Forest", "Rooftop", "Ninja Kitchen"];
  const bgColors = [
    "flat solid soft lavender periwinkle purple wall with warm sandy beige tan floor",
    "lush green bamboo forest with soft mossy ground",
    "twilight rooftop with deep navy sky and warm clay tiles",
    "cozy kitchen with pale mint walls and warm wooden countertops",
  ];
  const settingIndex =
    word.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) %
    settings.length;
  const setting = settings[settingIndex];
  const bgColor = bgColors[settingIndex];

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an expert animation script writer for children's educational content. You write 15-second vertical (9:16) animation scripts for a "Word of the Day" series.

CHARACTER: ${characterName}
VISUAL DNA (strict rules — never deviate):
${visualDna}

SETTING FOR THIS EPISODE: ${setting}
BACKGROUND: ${bgColor}

WORD: "${word}"

Write a complete 15-second animation script following this EXACT structure:

1. FRAME 1 — THE HOOK (0-3s):
   - ${characterName} enters the 9:16 vertical frame in the ${setting} setting.
   - The word "${word}" MUST be displayed at the top of the frame in large, bold, all lowercase letters with clean black outlines.
   - The character strikes an attention-grabbing pose.

2. THE ACTION (3-10s):
   - ${characterName} performs a "Ninja Mission" that CLEARLY demonstrates the meaning of "${word}".
   - The action must be exaggerated, fun, and unmistakably tied to the word's definition.
   - Include squash-and-stretch cartoon physics.

3. THE FAIL/GAG (10-13s):
   - The mission ends with a small "ninja-fail" or humorous moment.
   - Examples: trying to look cool but tripping, a butterfly landing on their nose, accidentally launching themselves, a prop falling on their head.
   - Keep it gentle and funny — appropriate for preschool/kindergarten viewers.

4. FINALE (13-15s):
   - ${characterName} recovers with a cute reaction.
   - The word "${word}" pulses or glows in the background.
   - Colorful confetti or stars celebrate the moment.

NARRATOR LINES (must include 4 lines with approximate timestamps):
- Line 1 (0s): "Today's word of the day is... ${word}!"
- Line 2 (~4s): A setup line encouraging the action.
- Line 3 (~8s): A reaction to the peak action moment.
- Line 4 (~13s): A closing celebration line reinforcing the word.

CRITICAL NEGATIVE RULES:
- No on-screen captions or subtitles (narrator is offscreen).
- No capital letters for the word "${word}".
- Strictly follow the Visual DNA rules — no deviation from the character design.
- No realistic rendering — maintain 2D cartoon style throughout.

Return ONLY valid JSON in this exact format:
{
  "word": "${word}",
  "setting": "${setting}",
  "background": "${bgColor}",
  "script": "The complete animation script as a single string with paragraph breaks as \\n\\n",
  "narratorLines": [
    {"time": "0s", "line": "..."},
    {"time": "~4s", "line": "..."},
    {"time": "~8s", "line": "..."},
    {"time": "~13s", "line": "..."}
  ],
  "negativePrompt": "A comma-separated string of things to avoid for the AI video generator"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const script = JSON.parse(cleaned);

    return NextResponse.json(script);
  } catch (error: unknown) {
    console.error("Gemini script generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
