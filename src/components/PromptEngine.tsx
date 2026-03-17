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

  // Step 1: Characters
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
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

  // Cross-reference
  const [uploadedWords, setUploadedWords] = useState<string[]>([]);

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

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/characters")).then((r) => r.json()),
      fetch(apiUrl("/api/words")).then((r) => r.json()),
      fetch(apiUrl("/api/scripts")).then((r) => r.json()),
      fetch(apiUrl("/api/words"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "crossref" }),
      }).then((r) => r.json()),
    ])
      .then(([charData, wordData, scriptData, crossrefData]) => {
        if (charData.characters) setCharacters(charData.characters);
        if (wordData.words) setWords(wordData.words);
        if (scriptData.scripts) setScripts(scriptData.scripts);
        if (crossrefData.uploaded) setUploadedWords(crossrefData.uploaded);
      })
      .catch(() => {})
      .finally(() => {
        setLoadingChars(false);
        setLoadingWords(false);
        setLoadingScripts(false);
      });
  }, [apiUrl]);

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
            body: JSON.stringify({ action: "check", word: clean }),
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
        body: JSON.stringify({ word: clean }),
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
        body: JSON.stringify({ action: "import", words: csvImportText }),
      });
      const data = await res.json();
      setImportResult(data);

      // Reload words
      const wordsRes = await fetch(apiUrl("/api/words"));
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
          body: JSON.stringify({ action: "delete", word }),
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
        body: JSON.stringify({ action: "seed" }),
      });
      const data = await res.json();
      setSeedResult(data);
      setTimeout(() => setSeedResult(null), 5000);

      // Reload words
      const wordsRes = await fetch(apiUrl("/api/words"));
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
        {/* ── Header ── */}
        <header className="sticky top-0 z-30 backdrop-blur-md bg-[#f8f7f4]/80 border-b border-gray-200/60">
          <div className="flex items-center justify-between px-8 py-5">
            <div>
              <h1 className="text-2xl font-bold text-epic-purple tracking-tight font-roboto flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-epic-pink/10 text-epic-pink">
                  <Scroll className="w-5 h-5" />
                </span>
                {t("prompt.title")}
              </h1>
              <p className="text-sm text-epic-purple/50 mt-0.5 font-georgia flex items-center gap-2">
                Seedance 2.0 Script Generator
                <span className="inline-flex items-center gap-1 text-xs text-epic-teal font-roboto">
                  <Database className="w-3 h-3" />
                  SQLite
                </span>
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

            {/* ── 3-Step Progress Bar ── */}
            <div className="flex items-center gap-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-2">
              {[
                { step: 1, label: "Select Character", icon: Palette },
                { step: 2, label: "Pick Word", icon: ListChecks },
                { step: 3, label: "Generate", icon: Zap },
              ].map(({ step, label, icon: Icon }, idx) => (
                <button
                  key={step}
                  onClick={() => setCurrentStep(step)}
                  className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                    currentStep === step
                      ? "bg-epic-purple text-white shadow-md"
                      : currentStep > step
                      ? "text-epic-teal"
                      : "text-epic-purple/40"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      currentStep === step
                        ? "bg-white/20 text-white"
                        : currentStep > step
                        ? "bg-epic-teal/20 text-epic-teal"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {currentStep > step ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step
                    )}
                  </div>
                  <span className="hidden sm:inline">{label}</span>
                  <Icon className="w-4 h-4 sm:hidden" />
                  {idx < 2 && (
                    <div className={`ml-auto w-8 h-0.5 rounded ${
                      currentStep > step ? "bg-epic-teal/30" : "bg-gray-200"
                    }`} />
                  )}
                </button>
              ))}
            </div>

            {/* ════════════════════════════════════════════════════════ */}
            {/*  STEP 1: Select Character                               */}
            {/* ════════════════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-epic-purple flex items-center gap-2">
                    <Palette className="w-5 h-5 text-epic-teal" />
                    Step 1: Select Character
                  </h2>
                  <button
                    onClick={() => setShowNewChar(!showNewChar)}
                    className="flex items-center gap-1.5 text-xs font-medium text-epic-blue hover:text-epic-blue/80 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add New Character
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Character cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {characters.map((char) => (
                      <button
                        key={char.id}
                        onClick={() => {
                          setSelectedCharId(char.id);
                          setCurrentStep(2);
                        }}
                        className={`relative group text-left p-5 rounded-2xl border-2 transition-all ${
                          selectedCharId === char.id
                            ? "border-epic-purple bg-epic-purple/5 shadow-md shadow-epic-purple/10"
                            : "border-gray-100 bg-gray-50/50 hover:border-epic-blue/30 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${
                              selectedCharId === char.id
                                ? "bg-epic-purple text-white"
                                : "bg-gray-200/80 text-epic-purple/60"
                            }`}
                          >
                            {char.name[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-epic-purple">{char.name}</p>
                            <p className="text-xs text-epic-purple/40">
                              {selectedCharId === char.id ? "Selected" : "Click to select"}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-epic-purple/50 line-clamp-3 font-mono leading-relaxed">
                          {char.visualDna.slice(0, 150)}...
                        </p>

                        {/* Delete button for non-default */}
                        {char.id !== "kitten-ninja" && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCharacterHandler(char.id);
                            }}
                            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            ×
                          </span>
                        )}

                        {/* Selected indicator */}
                        {selectedCharId === char.id && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="w-6 h-6 text-epic-purple" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* New character form */}
                  {showNewChar && (
                    <div className="rounded-xl border border-dashed border-epic-blue/30 bg-epic-blue/5 p-5 space-y-3">
                      <input
                        value={newCharName}
                        onChange={(e) => setNewCharName(e.target.value)}
                        placeholder="Character name (e.g., Captain Quill)"
                        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-epic-purple placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-epic-blue/30"
                      />
                      <textarea
                        value={newCharDna}
                        onChange={(e) => setNewCharDna(e.target.value)}
                        placeholder="Visual DNA — describe the character's appearance rules, style constraints, and personality..."
                        rows={6}
                        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-epic-purple placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-epic-blue/30 resize-none font-mono"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={addCharacter}
                          disabled={!newCharName.trim() || !newCharDna.trim()}
                          className="px-5 py-2.5 rounded-lg bg-epic-blue text-white text-sm font-medium hover:bg-epic-blue/90 transition-colors disabled:opacity-40"
                        >
                          Save Character
                        </button>
                        <button
                          onClick={() => setShowNewChar(false)}
                          className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Continue button */}
                  {selectedChar && (
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-epic-purple px-6 py-3.5 text-white font-semibold text-sm shadow-lg shadow-epic-purple/20 hover:shadow-xl transition-all"
                    >
                      Continue with {selectedChar.name}
                      <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════ */}
            {/*  STEP 2: Pick or Add Word                               */}
            {/* ════════════════════════════════════════════════════════ */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Active character badge */}
                <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
                  <div className="w-10 h-10 rounded-xl bg-epic-purple flex items-center justify-center text-white text-lg font-bold">
                    {selectedChar?.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-epic-purple">{selectedChar?.name}</p>
                    <p className="text-xs text-epic-purple/40">Character locked in — Visual DNA active</p>
                  </div>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="text-xs text-epic-blue hover:text-epic-blue/80 font-medium"
                  >
                    Change
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Word Library */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h2 className="text-lg font-bold text-epic-purple flex items-center gap-2">
                        <ListChecks className="w-5 h-5 text-epic-blue" />
                        Step 2: Pick Your Word
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

                    <div className="p-5 space-y-4">
                      {/* CSV Import */}
                      {showCsvImport && (
                        <div className="rounded-xl border border-dashed border-epic-blue/30 bg-epic-blue/5 p-4 space-y-3">
                          <textarea
                            value={csvImportText}
                            onChange={(e) => setCsvImportText(e.target.value)}
                            placeholder="Paste words separated by commas, semicolons, or new lines:&#10;far, high, open, close, near, run, jump..."
                            rows={4}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-epic-purple placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-epic-blue/30 resize-none"
                          />
                          <div className="flex items-center gap-3">
                            <button
                              onClick={importCsv}
                              disabled={!csvImportText.trim()}
                              className="px-4 py-2 rounded-lg bg-epic-blue text-white text-sm font-medium hover:bg-epic-blue/90 disabled:opacity-40"
                            >
                              Import Words
                            </button>
                            <button
                              onClick={() => { setShowCsvImport(false); setCsvImportText(""); }}
                              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                            {importResult && (
                              <span className="text-xs text-epic-teal font-medium">
                                Added {importResult.added} words, {importResult.duplicates} duplicates skipped
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Seed result */}
                      {seedResult && (
                        <div className="flex items-center gap-2 rounded-xl bg-epic-teal/10 border border-epic-teal/20 px-4 py-2.5 text-sm text-epic-teal font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Loaded {seedResult.added} sight words ({seedResult.duplicates} already existed)
                        </div>
                      )}

                      {/* Tabs: Pending / Produced */}
                      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                        <button
                          onClick={() => setWordTab("pending")}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            wordTab === "pending"
                              ? "bg-white text-epic-purple shadow-sm"
                              : "text-epic-purple/50 hover:text-epic-purple/70"
                          }`}
                        >
                          <Clock className="w-4 h-4" />
                          Pending
                          <span className="bg-epic-pink/10 text-epic-pink text-xs font-bold px-2 py-0.5 rounded-full">
                            {pendingWords.length}
                          </span>
                        </button>
                        <button
                          onClick={() => setWordTab("produced")}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            wordTab === "produced"
                              ? "bg-white text-epic-purple shadow-sm"
                              : "text-epic-purple/50 hover:text-epic-purple/70"
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Produced
                          <span className="bg-epic-teal/20 text-epic-purple text-xs font-bold px-2 py-0.5 rounded-full">
                            {producedWords.length}
                          </span>
                        </button>
                      </div>

                      {/* Word grid */}
                      {wordTab === "pending" && (
                        <div className="space-y-2">
                          {pendingWords.length === 0 ? (
                            <div className="text-center py-8 text-sm text-epic-purple/30">
                              No pending words. Add some below or import a CSV.
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {pendingWords.map((w) => (
                                <button
                                  key={w.id}
                                  onClick={() => {
                                    setSelectedWord(w.word);
                                    setCurrentStep(3);
                                  }}
                                  className={`group relative px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                    selectedWord === w.word
                                      ? "bg-epic-pink text-white shadow-md shadow-epic-pink/20"
                                      : "bg-gray-50 text-epic-purple hover:bg-epic-pink/10 hover:text-epic-pink border border-gray-100 hover:border-epic-pink/30"
                                  }`}
                                >
                                  {w.word}
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteWordHandler(w.word);
                                    }}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                  >
                                    ×
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {wordTab === "produced" && (
                        <div className="space-y-2">
                          {producedWords.length === 0 ? (
                            <div className="text-center py-8 text-sm text-epic-purple/30">
                              No produced words yet. Generate some scripts!
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap gap-2">
                                {producedWords.map((w) => {
                                  const isUploaded = uploadedWords.includes(w.word);
                                  return (
                                    <span
                                      key={w.id}
                                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border ${
                                        isUploaded
                                          ? "bg-epic-blue/10 text-epic-blue border-epic-blue/20"
                                          : "bg-epic-teal/10 text-epic-teal border-epic-teal/20"
                                      }`}
                                      title={isUploaded ? "Script + Uploaded to YouTube" : "Script generated (not yet uploaded)"}
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      {w.word}
                                      {isUploaded && (
                                        <span className="w-2 h-2 rounded-full bg-epic-blue" title="Uploaded" />
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                              <div className="flex items-center gap-4 pt-2 text-xs text-epic-purple/40">
                                <span className="flex items-center gap-1">
                                  <span className="w-2.5 h-2.5 rounded-full bg-epic-teal/60" /> Scripted
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="w-2.5 h-2.5 rounded-full bg-epic-blue" /> Uploaded to YouTube
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Add New Word panel */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-epic-purple flex items-center gap-2">
                        <Plus className="w-4 h-4 text-epic-pink" />
                        Add New Word
                      </h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <input
                          value={newWordInput}
                          onChange={(e) => {
                            setNewWordInput(e.target.value);
                            checkDuplicate(e.target.value);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && addNewWord()}
                          placeholder="Type a word..."
                          className={`w-full rounded-xl border px-4 py-3 text-lg font-bold text-epic-purple placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:ring-2 transition-all ${
                            duplicateWarning
                              ? "border-red-300 focus:ring-red-200 bg-red-50/50"
                              : "border-gray-200 focus:ring-epic-blue/30"
                          }`}
                        />
                        {duplicateWarning && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-red-600 font-medium">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {duplicateWarning}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={addNewWord}
                        disabled={!newWordInput.trim()}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-epic-purple px-4 py-3 text-white text-sm font-semibold hover:bg-epic-purple/90 transition-all disabled:opacity-40"
                      >
                        <Plus className="w-4 h-4" />
                        Add to Pending
                      </button>

                      {/* Quick stats */}
                      <div className="pt-4 border-t border-gray-100 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-epic-purple/50">Total words</span>
                          <span className="font-bold text-epic-purple">{words.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-epic-purple/50">Pending</span>
                          <span className="font-bold text-epic-pink">{pendingWords.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-epic-purple/50">Produced</span>
                          <span className="font-bold text-epic-teal">{producedWords.length}</span>
                        </div>
                        {words.length > 0 && (
                          <div className="pt-2">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-epic-teal rounded-full transition-all"
                                style={{ width: `${(producedWords.length / words.length) * 100}%` }}
                              />
                            </div>
                            <p className="text-xs text-epic-purple/40 mt-1 text-center">
                              {Math.round((producedWords.length / words.length) * 100)}% complete
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════ */}
            {/*  STEP 3: One-Click Generate                             */}
            {/* ════════════════════════════════════════════════════════ */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {/* Context bar */}
                <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-epic-purple flex items-center justify-center text-white text-sm font-bold">
                      {selectedChar?.name[0]}
                    </div>
                    <span className="text-sm font-medium text-epic-purple">{selectedChar?.name}</span>
                  </div>
                  <div className="w-px h-6 bg-gray-200" />
                  {selectedWord ? (
                    <span className="inline-flex items-center px-4 py-1.5 rounded-lg bg-epic-pink/10 text-epic-pink font-bold text-lg">
                      {selectedWord}
                    </span>
                  ) : (
                    <span className="text-sm text-epic-purple/40">No word selected</span>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => setCurrentStep(1)} className="text-xs text-epic-blue hover:text-epic-blue/80 font-medium">
                      Change Character
                    </button>
                    <button onClick={() => setCurrentStep(2)} className="text-xs text-epic-blue hover:text-epic-blue/80 font-medium">
                      Change Word
                    </button>
                  </div>
                </div>

                {/* Generate panel */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-epic-purple flex items-center gap-2">
                      <Zap className="w-5 h-5 text-epic-yellow" />
                      Step 3: Generate Seedance Prompt
                    </h2>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Environment preview */}
                    <div className="rounded-xl overflow-hidden border border-gray-100">
                      <div className="h-24 bg-gradient-to-b from-[#E8E0F0] to-[#D4C8E2] flex items-center justify-center">
                        <span className="text-4xl font-black text-epic-purple/20 tracking-widest">
                          {selectedWord || "word"}
                        </span>
                      </div>
                      <div className="h-12 bg-gradient-to-b from-[#E8D5B0] to-[#DCC9A0]" />
                      <div className="px-4 py-2 bg-gray-50 text-xs text-epic-purple/40 text-center">
                        Lavender wall + Tan floor — Hard-coded environment
                      </div>
                    </div>

                    {/* Rules summary */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-epic-purple/5 p-3 text-center">
                        <p className="text-2xl font-bold text-epic-purple">15s</p>
                        <p className="text-xs text-epic-purple/50">Duration</p>
                      </div>
                      <div className="rounded-xl bg-epic-purple/5 p-3 text-center">
                        <p className="text-2xl font-bold text-epic-purple">9:16</p>
                        <p className="text-xs text-epic-purple/50">Vertical</p>
                      </div>
                      <div className="rounded-xl bg-epic-purple/5 p-3 text-center">
                        <p className="text-2xl font-bold text-epic-purple">Silent</p>
                        <p className="text-xs text-epic-purple/50">Character</p>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={generateScript}
                        disabled={generating || batchGenerating || !selectedWord}
                        className="flex-1 flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-epic-pink to-epic-purple px-6 py-4 text-white font-bold text-base shadow-lg shadow-epic-pink/20 hover:shadow-xl hover:shadow-epic-pink/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generating &ldquo;{selectedWord}&rdquo;...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            Generate Seedance Prompt
                          </>
                        )}
                      </button>

                      {pendingWords.length > 0 && (
                        <button
                          onClick={batchGenerateAll}
                          disabled={generating || batchGenerating || pendingWords.length === 0}
                          className="flex items-center justify-center gap-2 rounded-xl bg-epic-purple px-5 py-4 text-white font-bold text-sm shadow-lg hover:bg-epic-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {batchGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {batchProgress.current}/{batchProgress.total}
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4" />
                              Batch All ({pendingWords.length})
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Generated Scripts ── */}
                {scripts.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-epic-purple flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-epic-blue" />
                        Generated Scripts
                        <span className="text-xs font-normal text-epic-purple/40">
                          ({scripts.length})
                        </span>
                      </h2>
                    </div>

                    <div className="divide-y divide-gray-50">
                      {scripts.map((script) => (
                        <div key={script.id}>
                          {/* Row */}
                          <div
                            className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
                            onClick={() =>
                              setExpandedScript(expandedScript === script.id ? null : script.id)
                            }
                          >
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-epic-yellow/10 text-epic-purple font-bold text-sm min-w-[60px] justify-center">
                              {script.word}
                            </span>
                            <span className="text-sm text-epic-purple/50">{script.characterName}</span>
                            {script.colorCategory && (
                              <span
                                className="inline-block w-5 h-5 rounded-md border border-gray-200 flex-shrink-0"
                                style={{ background: script.bgColor || "#EDE9FE" }}
                                title={script.colorCategory}
                              />
                            )}
                            {/* Word count badge */}
                            {(() => {
                              const wc = wordCount(script.script);
                              const over = wc > 400;
                              return (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium flex-shrink-0 ${
                                    over
                                      ? "bg-red-100 text-red-600"
                                      : "bg-emerald-50 text-emerald-600"
                                  }`}
                                  title={over ? "Over 400-word Seedance limit!" : "Within limit"}
                                >
                                  {wc}w
                                </span>
                              );
                            })()}
                            <span className="text-sm text-epic-purple/40 truncate flex-1">
                              {script.script.slice(0, 60)}...
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyScript(script);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-epic-blue/10 text-epic-blue hover:bg-epic-blue/20 transition-colors"
                              >
                                {copiedId === script.id ? (
                                  <><Check className="w-3.5 h-3.5" /> Copied</>
                                ) : (
                                  <><Copy className="w-3.5 h-3.5" /> Copy</>
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteScriptHandler(script.id);
                                }}
                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {expandedScript === script.id ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          </div>

                          {/* Expanded */}
                          {expandedScript === script.id && (
                            <div className="px-6 pb-5 bg-gray-50/30">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                {/* Script */}
                                <div className="lg:col-span-2 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider">
                                      Full Animation Script
                                    </h4>
                                    {(() => {
                                      const wc = wordCount(script.script);
                                      const over = wc > 400;
                                      return (
                                        <span
                                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium ${
                                            over
                                              ? "bg-red-100 text-red-600"
                                              : "bg-emerald-50 text-emerald-600"
                                          }`}
                                        >
                                          {wc} / 400 words
                                          {over && <AlertTriangle className="w-3 h-3" />}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div className="rounded-xl bg-white border border-gray-100 p-5 text-sm text-epic-purple/80 leading-relaxed whitespace-pre-wrap font-mono">
                                    {script.script}
                                  </div>
                                </div>

                                {/* Sidebar */}
                                <div className="space-y-4">
                                  {/* Narrator — separate copyable */}
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider">
                                        Narrator Lines (Offscreen)
                                      </h4>
                                      <button
                                        onClick={() => copyNarrator(script)}
                                        className="flex items-center gap-1 text-xs font-medium text-epic-blue hover:text-epic-blue/80 transition-colors"
                                      >
                                        {copiedId === `narrator-${script.id}` ? (
                                          <><Check className="w-3 h-3" /> Copied</>
                                        ) : (
                                          <><Copy className="w-3 h-3" /> Copy Lines</>
                                        )}
                                      </button>
                                    </div>
                                    <div className="rounded-xl bg-white border border-epic-blue/20 p-4 space-y-2.5">
                                      {script.narratorLines.map((nl, i) => (
                                        <div key={i} className="flex gap-3 text-sm">
                                          <span className="text-epic-blue font-mono font-medium shrink-0 w-12">
                                            {nl.time}
                                          </span>
                                          <span className="text-epic-purple/70 italic">
                                            &ldquo;{nl.line}&rdquo;
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Negative prompt */}
                                  <div>
                                    <h4 className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider mb-2">
                                      Negative Prompt (Safeguard)
                                    </h4>
                                    <div className="rounded-xl bg-red-50/50 border border-red-100/50 p-4 text-xs text-red-600/70 font-mono leading-relaxed">
                                      {script.negativePrompt}
                                    </div>
                                  </div>
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
          </div>
        )}
      </main>
    </div>
  );
}
