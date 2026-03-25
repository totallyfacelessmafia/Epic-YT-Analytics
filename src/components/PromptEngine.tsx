"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import {
  Wand2,
  Copy,
  Check,
  Trash2,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Scroll,
  Palette,
  Download,
  AlertCircle,
  Database,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ListChecks,
  Zap,
} from "lucide-react";
import { LanguageProvider, useLanguage } from "@/i18n/LanguageContext";
import Sidebar from "./Sidebar";
import LanguageToggle from "./LanguageToggle";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CharacterProfile {
  id: string;
  name: string;
  visualDna: string;
  createdAt: number;
}

interface NarratorLine {
  time: string;
  line: string;
}

interface GeneratedScript {
  id: string;
  word: string;
  characterId: string;
  characterName: string;
  setting: string;
  background: string;
  script: string;
  narratorLines: NarratorLine[];
  negativePrompt: string;
  colorCategory: string;
  bgColor: string;
  generatedAt: number;
}

interface WordEntry {
  id: number;
  word: string;
  status: string;
  characterId: string | null;
  addedAt: number;
  producedAt: number | null;
}

/* ------------------------------------------------------------------ */
/*  Default Kitten Ninja — always available as fallback                 */
/* ------------------------------------------------------------------ */

const DEFAULT_KITTEN_NINJA: CharacterProfile = {
  id: "kitten-ninja",
  name: "Kitten Ninja",
  visualDna: `Kitten Ninja is a cute chibi-style grey cat wearing a black ninja gi uniform with red/coral trim and a red/coral ninja mask on his face.
EYES: MUST be two small solid black dots ONLY. No eyebrows, no eyelashes, no white sclera, no blinking.
MOUTH: MUST be a simple open happy "u" shape. It is a static black outline. No tongue, no teeth, no movement.
PAWS: Simple round paws. NO claws, NO detailed toe beans.
STYLE: 2D clean-line cartoon. No realistic fur, no shading gradients, no 3D rendering. Flat colors only.
PERSONALITY: Brave but clumsy. Tries hard to be cool but always has a small comedic fail.
BRANDING: Epic Original. Book series by Colleen AF Venable and Stephanie Yue.
SILENT RULE: Kitten Ninja NEVER speaks. No dialogue, no speech bubbles. Only the offscreen narrator has lines.`,
  createdAt: Date.now(),
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PromptEngine({ accessKey }: { accessKey: string }) {
  return (
    <LanguageProvider>
      <Suspense>
        <PromptEngineContent accessKey={accessKey} />
      </Suspense>
    </LanguageProvider>
  );
}

function PromptEngineContent({ accessKey }: { accessKey: string }) {
  const { t } = useLanguage();

  const apiUrl = useCallback(
    (path: string) => `${path}?key=${encodeURIComponent(accessKey)}`,
    [accessKey]
  );

  /* ---- State ---- */

  // Step 1: Characters (start with hardcoded Kitten Ninja so it's always visible)
  const [characters, setCharacters] = useState<CharacterProfile[]>([DEFAULT_KITTEN_NINJA]);
  const [selectedCharId, setSelectedCharId] = useState("kitten-ninja");
  const [showNewChar, setShowNewChar] = useState(false);
  const [newCharName, setNewCharName] = useState("");
  const [newCharDna, setNewCharDna] = useState("");
  const [loadingChars, setLoadingChars] = useState(true);

  // Step 2: Word Library
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loadingWords, setLoadingWords] = useState(true);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [newWordInput, setNewWordInput] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [csvImportText, setCsvImportText] = useState("");
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; duplicates: number } | null>(null);
  const [wordTab, setWordTab] = useState<"pending" | "produced">("pending");

  // Step 3: Generation
  const [scripts, setScripts] = useState<GeneratedScript[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [textColor, setTextColor] = useState("green");
  const getHexColor = (name: string) =>
    name === "green" ? "#00FF00" : name === "blue" ? "#35AAFF" : name === "red" ? "#FF0000" : name === "white" ? "#FFFFFF" : "#E6D02C";

  const saveAsPng = useCallback(() => {
    const canvas = document.createElement("canvas");
    const w = 1080;
    const h = 1920;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      const word = (selectedWord || "word").toLowerCase();
      const hex = getHexColor(textColor);
      // Scale font to fit: large for short words, smaller for long words
      const maxFontSize = w * 0.28;
      const fontSize = Math.min(maxFontSize, (w * 0.85) / (word.length * 0.58));
      ctx.font = `900 ${fontSize}px "Arial Black", "Impact", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Thick dark stroke like the reference images
      ctx.lineWidth = fontSize * 0.12;
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineJoin = "round";
      ctx.fillStyle = hex;
      const textY = h * 0.18;
      ctx.strokeText(word, w / 2, textY);
      ctx.fillText(word, w / 2, textY);

      const link = document.createElement("a");
      link.download = `${word}-kitten-ninja-cover.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "/kitten-ninja-cover.png";
  }, [selectedWord, textColor]);

  // Cross-reference (unused for now)
  const [uploadedWords] = useState<string[]>([]);

  // UI
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [seedResult, setSeedResult] = useState<{ added: number; duplicates: number } | null>(null);

  const selectedChar = characters.find((c) => c.id === selectedCharId) ?? characters[0];
  const pendingWords = words.filter((w) => w.status === "pending");
  const producedWords = words.filter((w) => w.status === "produced");

  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- Load from database ---- */

  // Load characters once
  useEffect(() => {
    fetch(apiUrl("/api/characters")).then((r) => r.json())
      .then((charData) => {
        if (charData.characters && charData.characters.length > 0) {
          const dbChars = charData.characters as CharacterProfile[];
          const hasKitten = dbChars.some((c: CharacterProfile) => c.id === "kitten-ninja");
          setCharacters(hasKitten ? dbChars : [DEFAULT_KITTEN_NINJA, ...dbChars]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingChars(false));
  }, [apiUrl]);

  // Load words + scripts when character changes
  useEffect(() => {
    setLoadingWords(true);
    setLoadingScripts(true);
    setSelectedWord(null);

    Promise.all([
      fetch(apiUrl("/api/words") + `&characterId=${selectedCharId}`).then((r) => r.json()),
      fetch(apiUrl("/api/scripts") + `&characterId=${selectedCharId}`).then((r) => r.json()),
    ])
      .then(([wordData, scriptData]) => {
        if (wordData.words) setWords(wordData.words);
        if (scriptData.scripts) setScripts(scriptData.scripts);
      })
      .catch(() => {})
      .finally(() => {
        setLoadingWords(false);
        setLoadingScripts(false);
      });
  }, [apiUrl, selectedCharId]);

  /* ---- Step 1: Character CRUD ---- */

  const addCharacter = useCallback(async () => {
    if (!newCharName.trim() || !newCharDna.trim()) return;
    const id = newCharName.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    try {
      const res = await fetch(apiUrl("/api/characters"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newCharName.trim(), visualDna: newCharDna.trim() }),
      });
      const data = await res.json();
      if (data.character) {
        setCharacters((prev) => [...prev, data.character]);
        setSelectedCharId(id);
      }
    } catch {}
    setNewCharName("");
    setNewCharDna("");
    setShowNewChar(false);
  }, [newCharName, newCharDna, apiUrl]);

  const deleteCharacterHandler = useCallback(
    async (id: string) => {
      if (id === "kitten-ninja") return;
      try {
        await fetch(apiUrl("/api/characters"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", id }),
        });
        setCharacters((prev) => prev.filter((c) => c.id !== id));
        if (selectedCharId === id) setSelectedCharId("kitten-ninja");
      } catch {}
    },
    [selectedCharId, apiUrl]
  );

  /* ---- Step 2: Word Library ---- */

  const checkDuplicate = useCallback(
    (word: string) => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
      const clean = word.toLowerCase().trim();
      if (!clean) { setDuplicateWarning(""); return; }

      checkTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(apiUrl("/api/words"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "check", word: clean, characterId: selectedCharId }),
          });
          const data = await res.json();
          if (data.hasScript) {
            setDuplicateWarning(`Warning: You already made a video for "${clean}"!`);
          } else {
            setDuplicateWarning("");
          }
        } catch {}
      }, 300);
    },
    [apiUrl]
  );

  const addNewWord = useCallback(async () => {
    const clean = newWordInput.toLowerCase().trim();
    if (!clean) return;

    try {
      const res = await fetch(apiUrl("/api/words"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: clean, characterId: selectedCharId }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setDuplicateWarning(data.message || `"${clean}" already exists!`);
        return;
      }

      if (data.word) {
        setWords((prev) => [data.word, ...prev]);
        setSelectedWord(clean);
        setNewWordInput("");
        setDuplicateWarning("");
      }
    } catch {}
  }, [newWordInput, apiUrl]);

  const importCsv = useCallback(async () => {
    if (!csvImportText.trim()) return;
    try {
      const res = await fetch(apiUrl("/api/words"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", words: csvImportText, characterId: selectedCharId }),
      });
      const data = await res.json();
      setImportResult(data);

      // Reload words
      const wordsRes = await fetch(apiUrl("/api/words") + `&characterId=${selectedCharId}`);
      const wordsData = await wordsRes.json();
      if (wordsData.words) setWords(wordsData.words);

      setCsvImportText("");
      setTimeout(() => setImportResult(null), 5000);
    } catch {}
  }, [csvImportText, apiUrl]);

  const deleteWordHandler = useCallback(
    async (word: string) => {
      try {
        await fetch(apiUrl("/api/words"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", word, characterId: selectedCharId }),
        });
        setWords((prev) => prev.filter((w) => w.word !== word));
        if (selectedWord === word) setSelectedWord(null);
      } catch {}
    },
    [selectedWord, apiUrl]
  );

  /* ---- Seed sight words ---- */

  const seedSightWords = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/words"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed", characterId: selectedCharId }),
      });
      const data = await res.json();
      setSeedResult(data);
      setTimeout(() => setSeedResult(null), 5000);

      // Reload words
      const wordsRes = await fetch(apiUrl("/api/words") + `&characterId=${selectedCharId}`);
      const wordsData = await wordsRes.json();
      if (wordsData.words) setWords(wordsData.words);
    } catch {}
  }, [apiUrl]);

  /* ---- Step 3: Generate ---- */

  /** Generate a single word and return the script (used by both single and batch) */
  const generateOneWord = useCallback(async (word: string): Promise<GeneratedScript | null> => {
    if (!selectedChar) return null;

    try {
      const res = await fetch(apiUrl("/api/generate-script"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word,
          characterName: selectedChar.name,
          visualDna: selectedChar.visualDna,
          textColor,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const script: GeneratedScript = {
        id: `${word}-${Date.now()}`,
        word: data.word || word,
        characterId: selectedChar.id,
        characterName: selectedChar.name,
        setting: data.setting || "Lavender Dojo",
        background: data.background || "",
        script: data.script || "",
        narratorLines: data.narratorLines || [],
        negativePrompt: data.negativePrompt || "",
        colorCategory: data.colorCategory || "",
        bgColor: data.bgColor || "",
        generatedAt: Date.now(),
      };

      // Save script to DB
      await fetch(apiUrl("/api/scripts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });

      // Mark word as produced
      await fetch(apiUrl("/api/words"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "produce", word, characterId: selectedChar.id }),
      });

      return script;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed on "${word}": ${msg}`);
      return null;
    }
  }, [selectedChar, apiUrl]);

  /** Batch generate all pending words */
  const batchGenerateAll = useCallback(async () => {
    if (!selectedChar || pendingWords.length === 0) return;

    setBatchGenerating(true);
    setError("");
    setBatchProgress({ current: 0, total: pendingWords.length });
    setCurrentStep(3);

    const newScripts: GeneratedScript[] = [];

    for (let i = 0; i < pendingWords.length; i++) {
      setBatchProgress({ current: i + 1, total: pendingWords.length });
      const word = pendingWords[i].word;
      const script = await generateOneWord(word);

      if (script) {
        newScripts.push(script);
        setScripts((prev) => [script, ...prev]);
        setWords((prev) =>
          prev.map((w) =>
            w.word === word
              ? { ...w, status: "produced", producedAt: Date.now(), characterId: selectedChar.id }
              : w
          )
        );
      }
    }

    setBatchGenerating(false);
    if (newScripts.length > 0) setExpandedScript(newScripts[0].id);
  }, [selectedChar, pendingWords, generateOneWord]);

  const generateScript = useCallback(async () => {
    if (!selectedWord || !selectedChar) return;

    setGenerating(true);
    setError("");
    setCurrentStep(3);

    const script = await generateOneWord(selectedWord);

    if (script) {
      setScripts((prev) => [script, ...prev]);
      setWords((prev) =>
        prev.map((w) =>
          w.word === selectedWord
            ? { ...w, status: "produced", producedAt: Date.now(), characterId: selectedChar.id }
            : w
        )
      );
      setExpandedScript(script.id);
      setSelectedWord(null);
    }

    setGenerating(false);
  }, [selectedWord, selectedChar, generateOneWord]);

  /* ---- Copy helpers ---- */

  const copyScript = useCallback(async (script: GeneratedScript) => {
    const fullPrompt = `🎬 ANIMATION SCRIPT — ${script.characterName.toUpperCase()} "${script.word}"
Single Continuous 15-Second Video Prompt

A 15-second continuous vertical 9:16 kids educational cartoon video.

STRICT TEXT RULES: NO ON-SCREEN CAPTIONS, SUBTITLES, OR "WORD OF THE DAY" TEXT ALLOWED. The only visual text in the entire video is the single word ${script.word} written on the lavender wall in all lower case letters. No capital letters. The text is clean, bold, black-outlined, and static.

SILENT CHARACTER: ${script.characterName} NEVER speaks. Only the offscreen narrator has lines.

BACKGROUND: ${script.background}

${script.script}

🗣️ NARRATOR LINES (offscreen only)
${script.narratorLines.map((l) => `"${l.line}" — ${l.time}`).join("\n")}

💡 NEGATIVE PROMPT:
${script.negativePrompt}`;

    await navigator.clipboard.writeText(fullPrompt);
    setCopiedId(script.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const copyNarrator = useCallback(async (script: GeneratedScript) => {
    const narratorText = script.narratorLines
      .map((l) => `[${l.time}] ${l.line}`)
      .join("\n");
    await navigator.clipboard.writeText(narratorText);
    setCopiedId(`narrator-${script.id}`);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const deleteScriptHandler = useCallback(
    async (id: string) => {
      try {
        await fetch(apiUrl("/api/scripts"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", id }),
        });
        setScripts((prev) => prev.filter((s) => s.id !== id));
      } catch {}
    },
    [apiUrl]
  );

  const exportAll = useCallback(async () => {
    const all = scripts
      .map((s) => `${"=".repeat(60)}
🎬 ${s.characterName.toUpperCase()} — "${s.word}"
${"=".repeat(60)}

${s.script}

NARRATOR (offscreen):
${s.narratorLines.map((l) => `  ${l.time}: "${l.line}"`).join("\n")}

NEGATIVE PROMPT: ${s.negativePrompt}
`)
      .join("\n\n");

    const blob = new Blob([all], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `animation-scripts-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [scripts]);

  /* ---- Word count helper ---- */
  function wordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /* ---- Loading ---- */
  const isLoading = loadingChars || loadingWords || loadingScripts;

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */


  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      <Sidebar />

      <main className="ml-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-md bg-[#f8f7f4]/80 border-b border-gray-200/60">
          <div className="flex items-center justify-between px-8 py-5">
            <div>
              <h1 className="text-2xl font-bold text-epic-purple tracking-tight font-roboto flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-epic-pink/10 text-epic-pink">
                  <Scroll className="w-5 h-5" />
                </span>
                {t("prompt.title")}
              </h1>
              <p className="text-sm text-epic-purple/50 mt-0.5 font-georgia">
                Seedance 2.0 Script Generator
              </p>
            </div>
            <div className="flex items-center gap-3">
              {scripts.length > 0 && (
                <button
                  onClick={exportAll}
                  className="flex items-center gap-2 rounded-xl bg-epic-purple/5 px-4 py-2.5 text-sm font-medium text-epic-purple hover:bg-epic-purple/10 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export All
                </button>
              )}
              {pendingWords.length > 0 && (
                <button
                  onClick={batchGenerateAll}
                  disabled={generating || batchGenerating}
                  className="flex items-center gap-2 rounded-xl bg-epic-purple px-4 py-2.5 text-sm font-bold text-white hover:bg-epic-purple/90 transition-colors disabled:opacity-40"
                >
                  {batchGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {batchProgress.current}/{batchProgress.total}</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Batch All ({pendingWords.length})</>
                  )}
                </button>
              )}
              <LanguageToggle />
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-epic-purple/30" />
          </div>
        ) : (
          <div className="p-8 space-y-6">

            {/* ── Creation Portal: Two Column Layout ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* LEFT COLUMN: Character, Word, Preview */}
                  <div className="space-y-4">

                    {/* Character Dropdown */}
                    <div>
                      <label className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider block mb-1.5">Character Library</label>
                      <div className="flex gap-2">
                        <select
                          value={selectedCharId}
                          onChange={(e) => setSelectedCharId(e.target.value)}
                          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-epic-purple font-medium bg-white focus:outline-none focus:ring-2 focus:ring-epic-blue/30"
                        >
                          {characters.map((c) => (
                            <option key={c.id} value={c.id}>{c.name} ({words.filter(w => w.characterId === c.id).length > 0 ? `${producedWords.length} produced` : "0 words"})</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setShowNewChar(!showNewChar)}
                          className="px-3 py-2.5 rounded-xl border border-gray-200 text-epic-purple/50 hover:text-epic-blue hover:border-epic-blue/30 transition-colors"
                          title="Add new character"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* New Character Form (collapsible) */}
                    {showNewChar && (
                      <div className="rounded-xl border border-dashed border-epic-blue/30 bg-epic-blue/5 p-4 space-y-3">
                        <input
                          type="text"
                          value={newCharName}
                          onChange={(e) => setNewCharName(e.target.value)}
                          placeholder="Character Name"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epic-blue/30"
                        />
                        <textarea
                          value={newCharDna}
                          onChange={(e) => setNewCharDna(e.target.value)}
                          placeholder="Visual DNA description..."
                          rows={3}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epic-blue/30"
                        />
                        <div className="flex gap-2">
                          <button onClick={addCharacter} className="px-4 py-2 rounded-lg bg-epic-blue text-white text-sm font-medium hover:bg-epic-blue/90">Create</button>
                          <button onClick={() => setShowNewChar(false)} className="px-4 py-2 rounded-lg text-sm text-epic-purple/50 hover:text-epic-purple">Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Character DNA badge */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-epic-purple/5">
                      <div className="w-8 h-8 rounded-lg bg-epic-purple text-white flex items-center justify-center text-sm font-bold">
                        {selectedChar?.name?.[0] || "K"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-epic-purple">{selectedChar?.name}</p>
                        <p className="text-xs text-epic-purple/40 truncate">Visual DNA active</p>
                      </div>
                      {selectedCharId !== "kitten-ninja" && (
                        <button
                          onClick={() => deleteCharacterHandler(selectedCharId)}
                          className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Word of the Day input */}
                    <div>
                      <label className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider block mb-1.5">Word of the Day</label>
                      <input
                        type="text"
                        value={selectedWord || ""}
                        onChange={(e) => {
                          setSelectedWord(e.target.value.toLowerCase().trim() || null);
                        }}
                        placeholder="Type a word or click from library below..."
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-epic-purple font-medium bg-white focus:outline-none focus:ring-2 focus:ring-epic-blue/30"
                      />
                      {duplicateWarning && (
                        <p className="text-xs text-epic-pink mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {duplicateWarning}
                        </p>
                      )}
                    </div>

                    {/* Style Notes */}
                    <div>
                      <label className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider block mb-1.5">Style Notes <span className="font-normal">(optional)</span></label>
                      <input
                        type="text"
                        placeholder="e.g. lilac background, beach setting, rainy day mood"
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-epic-purple/60 bg-white focus:outline-none focus:ring-2 focus:ring-epic-blue/30"
                      />
                    </div>

                    {/* Word Color Preview (compact) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider">Word Color Preview</label>
                        <div className="flex items-center gap-2">
                          {[
                            { name: "green", hex: "#00FF00" },
                            { name: "blue", hex: "#35AAFF" },
                            { name: "red", hex: "#FF0000" },
                            { name: "white", hex: "#FFFFFF" },
                            { name: "yellow", hex: "#E6D02C" },
                          ].map((c) => (
                            <button
                              key={c.name}
                              onClick={() => setTextColor(c.name)}
                              className={`w-6 h-6 rounded-full border-2 transition-transform ${textColor === c.name ? "scale-125 border-epic-purple" : "border-gray-300"}`}
                              style={{ backgroundColor: c.hex }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-gray-100">
                        <div className="relative w-48" style={{ aspectRatio: "9/16" }}>
                          <img src="/kitten-ninja-cover.png" alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-start justify-center pt-[12%]">
                            <span
                              className="font-black lowercase"
                              style={{
                                fontSize: `clamp(1.5rem, ${Math.max(8 - (selectedWord?.length || 4), 3)}vw, 3.5rem)`,
                                color: getHexColor(textColor),
                                WebkitTextStroke: "1.5px black",
                                paintOrder: "stroke fill",
                              }}
                            >
                              {selectedWord || "word"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={saveAsPng}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-epic-blue/10 text-epic-blue hover:bg-epic-blue/20 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Save PNG (1080x1920)
                      </button>
                    </div>

                    {/* Specs row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-epic-purple/5 p-2 text-center">
                        <p className="text-lg font-bold text-epic-purple">15s</p>
                        <p className="text-[10px] text-epic-purple/50">Duration</p>
                      </div>
                      <div className="rounded-lg bg-epic-purple/5 p-2 text-center">
                        <p className="text-lg font-bold text-epic-purple">9:16</p>
                        <p className="text-[10px] text-epic-purple/50">Vertical</p>
                      </div>
                      <div className="rounded-lg bg-epic-purple/5 p-2 text-center">
                        <p className="text-lg font-bold text-epic-purple">Silent</p>
                        <p className="text-[10px] text-epic-purple/50">Character</p>
                      </div>
                    </div>

                    {/* Generate button */}
                    <button
                      onClick={generateScript}
                      disabled={generating || batchGenerating || !selectedWord}
                      className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-epic-pink to-epic-purple px-6 py-3.5 text-white font-bold text-sm shadow-lg shadow-epic-pink/20 hover:shadow-xl hover:shadow-epic-pink/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      {generating ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Generating &ldquo;{selectedWord}&rdquo;...</>
                      ) : (
                        <><Sparkles className="w-5 h-5" /> Generate Seedance Prompt</>
                      )}
                    </button>
                  </div>

                  {/* RIGHT COLUMN: Script Output */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-epic-purple">Video Script</h3>
                      <p className="text-xs text-epic-purple/40">This becomes the full Seedance prompt</p>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    {scripts.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-lg bg-epic-yellow/10 text-epic-purple font-bold text-sm">{scripts[0].word}</span>
                            {(() => {
                              const cc = scripts[0].script.length;
                              const over = cc > 2000;
                              return <span className={`text-xs font-mono px-2 py-0.5 rounded-md ${over ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>{cc.toLocaleString()}/2,000 chars</span>;
                            })()}
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => copyScript(scripts[0])} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-epic-blue/10 text-epic-blue hover:bg-epic-blue/20 transition-colors">
                              {copiedId === scripts[0].id ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                            </button>
                          </div>
                        </div>

                        {/* Script text (editable) */}
                        <textarea
                          value={scripts[0].script}
                          readOnly
                          className="w-full rounded-xl bg-white border border-gray-200 p-4 text-sm text-epic-purple/80 leading-relaxed font-mono resize-none focus:outline-none"
                          rows={12}
                        />

                        {/* Narrator lines */}
                        {scripts[0].narratorLines && scripts[0].narratorLines.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider">Narrator Lines</h4>
                              <button
                                onClick={() => copyNarrator(scripts[0])}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-epic-blue/10 text-epic-blue hover:bg-epic-blue/20"
                              >
                                {copiedId === `narrator-${scripts[0].id}` ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy Lines</>}
                              </button>
                            </div>
                            {scripts[0].narratorLines.map((nl: NarratorLine, i: number) => (
                              <div key={i} className="flex gap-3 items-start text-sm">
                                <span className="text-xs font-mono text-epic-blue bg-epic-blue/10 px-2 py-0.5 rounded flex-shrink-0">{nl.time}</span>
                                <span className="text-epic-purple/70 italic font-georgia">&ldquo;{nl.line}&rdquo;</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Negative prompt */}
                        {scripts[0].negativePrompt && (
                          <div className="space-y-1">
                            <h4 className="text-xs font-semibold text-red-400/80 uppercase tracking-wider">Negative Prompt (Safeguard)</h4>
                            <p className="text-xs text-red-400/60 leading-relaxed">{scripts[0].negativePrompt}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
                        <Sparkles className="w-8 h-8 text-epic-purple/15 mx-auto mb-3" />
                        <p className="text-sm text-epic-purple/30">Click &ldquo;Generate Seedance Prompt&rdquo; to create a 15-second narrative prompt, or write your own here.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Word Library (scoped to selected character) ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-epic-purple flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-epic-blue" />
                  Word Library
                  <span className="text-xs font-normal text-epic-purple/40">
                    {selectedChar?.name} &mdash; {words.length} words
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={seedSightWords}
                    className="flex items-center gap-1.5 text-xs font-medium text-epic-teal hover:text-epic-teal/80 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Seed Sight Words
                  </button>
                  <button
                    onClick={() => setShowCsvImport(!showCsvImport)}
                    className="flex items-center gap-1.5 text-xs font-medium text-epic-blue hover:text-epic-blue/80 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Import CSV
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Seed/Import results */}
                {seedResult && (
                  <div className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                    Added {seedResult.added} words, {seedResult.duplicates} already existed
                  </div>
                )}
                {importResult && (
                  <div className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                    Imported {importResult.added} words, {importResult.duplicates} duplicates skipped
                  </div>
                )}

                {/* CSV Import */}
                {showCsvImport && (
                  <div className="rounded-xl border border-dashed border-epic-blue/30 bg-epic-blue/5 p-4 space-y-3">
                    <textarea
                      value={csvImportText}
                      onChange={(e) => setCsvImportText(e.target.value)}
                      placeholder="Paste words separated by commas, semicolons, or new lines: far, high, open, close, near, run, jump..."
                      rows={3}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epic-blue/30"
                    />
                    <div className="flex gap-2">
                      <button onClick={importCsv} className="px-4 py-2 rounded-lg bg-epic-blue text-white text-sm font-medium hover:bg-epic-blue/90">Import Words</button>
                      <button onClick={() => setShowCsvImport(false)} className="px-4 py-2 rounded-lg text-sm text-epic-purple/50 hover:text-epic-purple">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Add single word */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWordInput}
                    onChange={(e) => {
                      setNewWordInput(e.target.value);
                      checkDuplicate(e.target.value);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && addNewWord()}
                    placeholder="Type a word to add..."
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-epic-blue/30"
                  />
                  <button
                    onClick={addNewWord}
                    disabled={!newWordInput.trim()}
                    className="px-4 py-2 rounded-lg bg-epic-yellow text-epic-purple text-sm font-medium hover:bg-epic-yellow/80 transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    Add
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-0 rounded-xl bg-gray-100/80 p-1">
                  <button
                    onClick={() => setWordTab("pending")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-medium transition-all ${
                      wordTab === "pending" ? "bg-white text-epic-purple shadow-sm" : "text-epic-purple/50"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Pending
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${wordTab === "pending" ? "bg-epic-pink/10 text-epic-pink" : "bg-gray-200 text-gray-500"}`}>
                      {pendingWords.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setWordTab("produced")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-medium transition-all ${
                      wordTab === "produced" ? "bg-white text-epic-purple shadow-sm" : "text-epic-purple/50"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Produced
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${wordTab === "produced" ? "bg-emerald-50 text-emerald-600" : "bg-gray-200 text-gray-500"}`}>
                      {producedWords.length}
                    </span>
                  </button>
                </div>

                {/* Word chips */}
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {(wordTab === "pending" ? pendingWords : producedWords).length === 0 ? (
                    <p className="text-xs text-epic-purple/30 py-4 w-full text-center">
                      {wordTab === "pending" ? "No pending words. Add some above or import a CSV." : "No produced words yet."}
                    </p>
                  ) : (
                    (wordTab === "pending" ? pendingWords : producedWords).map((w) => (
                      <button
                        key={w.id}
                        onClick={() => {
                          setSelectedWord(w.word);
                          checkDuplicate(w.word);
                        }}
                        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          selectedWord === w.word
                            ? "bg-epic-purple text-white"
                            : wordTab === "pending"
                            ? "bg-epic-yellow/10 text-epic-purple hover:bg-epic-yellow/20"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {w.word}
                        {uploadedWords.includes(w.word) && <span className="text-[10px] opacity-50">YT</span>}
                        <span
                          onClick={(e) => { e.stopPropagation(); deleteWordHandler(w.word); }}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-xs text-epic-purple/40 border-t border-gray-100 pt-3">
                  <span>Total words: <strong className="text-epic-purple">{words.length}</strong></span>
                  <span>Pending: <strong className="text-epic-pink">{pendingWords.length}</strong></span>
                  <span>Produced: <strong className="text-emerald-600">{producedWords.length}</strong></span>
                </div>
              </div>
            </div>

            {/* ── All Generated Scripts (history) ── */}
            {scripts.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-epic-purple flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-epic-blue" />
                    Script History
                    <span className="text-xs font-normal text-epic-purple/40">({scripts.length})</span>
                  </h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {scripts.map((script) => (
                    <div key={script.id}>
                      <div
                        className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => setExpandedScript(expandedScript === script.id ? null : script.id)}
                      >
                        <span className="inline-flex items-center px-3 py-1 rounded-lg bg-epic-yellow/10 text-epic-purple font-bold text-sm min-w-[60px] justify-center">{script.word}</span>
                        {(() => {
                          const cc = script.script.length;
                          return <span className={`text-xs font-mono px-2 py-0.5 rounded-md ${cc > 2000 ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>{cc.toLocaleString()}c</span>;
                        })()}
                        <span className="text-sm text-epic-purple/40 truncate flex-1">{script.script.slice(0, 80)}...</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); copyScript(script); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-epic-blue/10 text-epic-blue hover:bg-epic-blue/20 transition-colors">
                            {copiedId === script.id ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteScriptHandler(script.id); }} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {expandedScript === script.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </div>

                      {expandedScript === script.id && (
                        <div className="px-6 pb-5 bg-gray-50/30">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            <div className="lg:col-span-2">
                              <div className="rounded-xl bg-white border border-gray-100 p-5 text-sm text-epic-purple/80 leading-relaxed whitespace-pre-wrap font-mono">
                                {script.script}
                              </div>
                            </div>
                            <div className="space-y-3">
                              <h4 className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider">Narrator Lines</h4>
                              {script.narratorLines?.map((nl: NarratorLine, i: number) => (
                                <div key={i} className="flex gap-2 items-start text-sm">
                                  <span className="text-xs font-mono text-epic-blue bg-epic-blue/10 px-2 py-0.5 rounded flex-shrink-0">{nl.time}</span>
                                  <span className="text-epic-purple/70 italic font-georgia text-xs">&ldquo;{nl.line}&rdquo;</span>
                                </div>
                              ))}
                              <h4 className="text-xs font-semibold text-red-400/80 uppercase tracking-wider mt-4">Negative Prompt</h4>
                              <p className="text-xs text-red-400/60 leading-relaxed">{script.negativePrompt}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-gray-200/60 mt-8">
          <div className="px-8 py-4 text-xs text-epic-purple/30">
            Managed by Revelation Inc. AI
          </div>
        </footer>
      </main>
    </div>
  );
}
