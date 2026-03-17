"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Wand2,
  Copy,
  Check,
  Trash2,
  Plus,
  Play,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Scroll,
  Palette,
  Download,
  AlertCircle,
  Database,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PromptEngine({ accessKey }: { accessKey: string }) {
  const { t } = useLanguage();

  const apiUrl = useCallback(
    (path: string) => `${path}?key=${encodeURIComponent(accessKey)}`,
    [accessKey]
  );

  // Character profiles
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [selectedCharId, setSelectedCharId] = useState("kitten-ninja");
  const [showNewChar, setShowNewChar] = useState(false);
  const [newCharName, setNewCharName] = useState("");
  const [newCharDna, setNewCharDna] = useState("");
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [editCharDna, setEditCharDna] = useState("");
  const [loadingChars, setLoadingChars] = useState(true);

  // Word input
  const [wordInput, setWordInput] = useState("");

  // Generation state
  const [scripts, setScripts] = useState<GeneratedScript[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [loadingScripts, setLoadingScripts] = useState(true);

  // UI state
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedChar = characters.find((c) => c.id === selectedCharId) ?? characters[0];

  /* ---- Load from database on mount ---- */

  useEffect(() => {
    fetch(apiUrl("/api/characters"))
      .then((r) => r.json())
      .then((data) => {
        if (data.characters) setCharacters(data.characters);
      })
      .catch(() => {})
      .finally(() => setLoadingChars(false));

    fetch(apiUrl("/api/scripts"))
      .then((r) => r.json())
      .then((data) => {
        if (data.scripts) setScripts(data.scripts);
      })
      .catch(() => {})
      .finally(() => setLoadingScripts(false));
  }, [apiUrl]);

  /* ---- Character CRUD ---- */

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

  const saveEditedDna = useCallback(
    async (id: string) => {
      try {
        await fetch(apiUrl("/api/characters"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", id, visualDna: editCharDna }),
        });
        setCharacters((prev) =>
          prev.map((c) => (c.id === id ? { ...c, visualDna: editCharDna } : c))
        );
      } catch {}
      setEditingCharId(null);
    },
    [editCharDna, apiUrl]
  );

  /* ---- Script generation ---- */

  const generateScripts = useCallback(async () => {
    const words = wordInput
      .split(/[\n,]+/)
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);

    if (words.length === 0 || !selectedChar) return;

    setGenerating(true);
    setError("");
    setGenProgress({ current: 0, total: words.length });

    const newScripts: GeneratedScript[] = [];

    for (let i = 0; i < words.length; i++) {
      setGenProgress({ current: i + 1, total: words.length });
      try {
        const res = await fetch(apiUrl("/api/generate-script"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: words[i],
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
          id: `${words[i]}-${Date.now()}-${i}`,
          word: data.word || words[i],
          characterId: selectedChar.id,
          characterName: selectedChar.name,
          setting: data.setting || "",
          background: data.background || "",
          script: data.script || "",
          narratorLines: data.narratorLines || [],
          negativePrompt: data.negativePrompt || "",
          colorCategory: data.colorCategory || "",
          bgColor: data.bgColor || "",
          generatedAt: Date.now(),
        };

        newScripts.push(script);

        // Save to database
        fetch(apiUrl("/api/scripts"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script }),
        }).catch(() => {});
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(`Failed on "${words[i]}": ${msg}`);
      }
    }

    setScripts((prev) => [...newScripts, ...prev]);
    setGenerating(false);
    if (newScripts.length > 0) setExpandedScript(newScripts[0].id);
  }, [wordInput, selectedChar, apiUrl]);

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

  const clearAllScripts = useCallback(async () => {
    try {
      await fetch(apiUrl("/api/scripts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      setScripts([]);
    } catch {}
  }, [apiUrl]);

  /* ---- Copy to clipboard ---- */

  const copyScript = useCallback(async (script: GeneratedScript) => {
    const fullPrompt = `🎬 ANIMATION SCRIPT — ${script.characterName.toUpperCase()} "${script.word}"
Single Continuous 15-Second Video Prompt

A 15-second continuous vertical 9:16 kids educational cartoon video.

STRICT TEXT RULES: NO ON-SCREEN CAPTIONS, SUBTITLES, OR "WORD OF THE DAY" TEXT ALLOWED. The only visual text in the entire video is the single word ${script.word} written in the background in all lower case letters. No capital letters. The text is clean, bold, black-outlined, and static.

SETTING: ${script.setting}
BACKGROUND: ${script.background}

${script.script}

🗣️ NARRATOR LINES
${script.narratorLines.map((l) => `"${l.line}" — ${l.time}`).join("\n")}

💡 NEGATIVE PROMPT:
${script.negativePrompt}`;

    await navigator.clipboard.writeText(fullPrompt);
    setCopiedId(script.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  /* ---- Copy narrator only ---- */

  const copyNarrator = useCallback(async (script: GeneratedScript) => {
    const narratorText = script.narratorLines
      .map((l) => `[${l.time}] ${l.line}`)
      .join("\n");
    await navigator.clipboard.writeText(narratorText);
    setCopiedId(`narrator-${script.id}`);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const exportAll = useCallback(async () => {
    const all = scripts
      .map((s) => {
        return `${"=".repeat(60)}
🎬 ${s.characterName.toUpperCase()} — "${s.word}"
Setting: ${s.setting} | Color: ${s.colorCategory || "General"}
${"=".repeat(60)}

${s.script}

NARRATOR:
${s.narratorLines.map((l) => `  ${l.time}: "${l.line}"`).join("\n")}

NEGATIVE PROMPT: ${s.negativePrompt}
`;
      })
      .join("\n\n");

    const blob = new Blob([all], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `animation-scripts-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [scripts]);

  /* ---- Setting badge color ---- */

  function settingColor(setting: string) {
    switch (setting) {
      case "Dojo":
        return "bg-red-100 text-red-700";
      case "Bamboo Forest":
        return "bg-emerald-100 text-emerald-700";
      case "Rooftop":
        return "bg-indigo-100 text-indigo-700";
      case "Ninja Kitchen":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  /* ---- Loading state ---- */
  const isLoading = loadingChars || loadingScripts;

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
                {t("prompt.subtitle")}
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
                  {t("prompt.exportAll")}
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
            {/* ── Top row: Character + Word Input ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Character Profile Panel */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-epic-purple flex items-center gap-2">
                    <Palette className="w-4 h-4 text-epic-teal" />
                    {t("prompt.characterProfiles")}
                  </h2>
                  <button
                    onClick={() => setShowNewChar(!showNewChar)}
                    className="flex items-center gap-1.5 text-xs font-medium text-epic-blue hover:text-epic-blue/80 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("prompt.addCharacter")}
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Character selector */}
                  <div className="flex flex-wrap gap-2">
                    {characters.map((char) => (
                      <button
                        key={char.id}
                        onClick={() => {
                          setSelectedCharId(char.id);
                          setEditingCharId(null);
                        }}
                        className={`relative group px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                          selectedCharId === char.id
                            ? "bg-epic-purple text-white shadow-md shadow-epic-purple/20"
                            : "bg-gray-50 text-epic-purple/70 hover:bg-gray-100"
                        }`}
                      >
                        {char.name}
                        {char.id !== "kitten-ninja" && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCharacterHandler(char.id);
                            }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            ×
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* New character form */}
                  {showNewChar && (
                    <div className="rounded-xl border border-dashed border-epic-blue/30 bg-epic-blue/5 p-4 space-y-3">
                      <input
                        value={newCharName}
                        onChange={(e) => setNewCharName(e.target.value)}
                        placeholder={t("prompt.charNamePlaceholder")}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-epic-purple placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-epic-blue/30"
                      />
                      <textarea
                        value={newCharDna}
                        onChange={(e) => setNewCharDna(e.target.value)}
                        placeholder={t("prompt.charDnaPlaceholder")}
                        rows={5}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-epic-purple placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-epic-blue/30 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={addCharacter}
                          disabled={!newCharName.trim() || !newCharDna.trim()}
                          className="px-4 py-2 rounded-lg bg-epic-blue text-white text-sm font-medium hover:bg-epic-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t("prompt.save")}
                        </button>
                        <button
                          onClick={() => setShowNewChar(false)}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          {t("prompt.cancel")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Selected character Visual DNA */}
                  {selectedChar && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-epic-purple/60 uppercase tracking-wider">
                          {t("prompt.visualDna")}
                        </label>
                        <button
                          onClick={() => {
                            if (editingCharId === selectedChar.id) {
                              saveEditedDna(selectedChar.id);
                            } else {
                              setEditingCharId(selectedChar.id);
                              setEditCharDna(selectedChar.visualDna);
                            }
                          }}
                          className="text-xs font-medium text-epic-blue hover:text-epic-blue/80 transition-colors"
                        >
                          {editingCharId === selectedChar.id
                            ? t("prompt.saveDna")
                            : t("prompt.editDna")}
                        </button>
                      </div>
                      {editingCharId === selectedChar.id ? (
                        <textarea
                          value={editCharDna}
                          onChange={(e) => setEditCharDna(e.target.value)}
                          rows={8}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-epic-purple leading-relaxed focus:outline-none focus:ring-2 focus:ring-epic-blue/30 resize-none font-mono"
                        />
                      ) : (
                        <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-epic-purple/80 leading-relaxed max-h-48 overflow-y-auto font-mono whitespace-pre-wrap">
                          {selectedChar.visualDna}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Word Input + Generate Panel */}
              <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-epic-purple flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-epic-yellow" />
                    {t("prompt.scriptGenerator")}
                  </h2>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-epic-purple/60 uppercase tracking-wider block mb-2">
                      {t("prompt.wordsLabel")}
                    </label>
                    <textarea
                      value={wordInput}
                      onChange={(e) => setWordInput(e.target.value)}
                      placeholder={t("prompt.wordsPlaceholder")}
                      rows={4}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-epic-purple placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-epic-blue/30 resize-none leading-relaxed"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                      {t("prompt.wordsHint")}
                    </p>
                  </div>

                  {/* Active character badge */}
                  {selectedChar && (
                    <div className="flex items-center gap-3 rounded-xl bg-epic-purple/5 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-epic-purple/10 flex items-center justify-center text-epic-purple text-sm font-bold">
                        {selectedChar.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-epic-purple">
                          {selectedChar.name}
                        </p>
                        <p className="text-xs text-epic-purple/50">
                          {t("prompt.activeCharacter")}
                        </p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    onClick={generateScripts}
                    disabled={generating || !wordInput.trim()}
                    className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-epic-pink to-epic-purple px-6 py-3.5 text-white font-semibold text-sm shadow-lg shadow-epic-pink/20 hover:shadow-xl hover:shadow-epic-pink/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("prompt.generating")} {genProgress.current}/
                        {genProgress.total}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {t("prompt.generateBtn")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Scripts Dashboard ── */}
            {scripts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-epic-purple flex items-center gap-2">
                    <Play className="w-4 h-4 text-epic-blue" />
                    {t("prompt.generatedScripts")}{" "}
                    <span className="text-xs font-normal text-epic-purple/40">
                      ({scripts.length})
                    </span>
                  </h2>
                  <button
                    onClick={clearAllScripts}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium"
                  >
                    {t("prompt.clearAll")}
                  </button>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50/50 border-b border-gray-100 text-xs font-semibold text-epic-purple/50 uppercase tracking-wider">
                  <div className="col-span-2">{t("prompt.colWord")}</div>
                  <div className="col-span-2">{t("prompt.colCharacter")}</div>
                  <div className="col-span-2">{t("prompt.colSetting")}</div>
                  <div className="col-span-1">Color</div>
                  <div className="col-span-2">{t("prompt.colPreview")}</div>
                  <div className="col-span-3 text-right">
                    {t("prompt.colActions")}
                  </div>
                </div>

                {/* Table rows */}
                <div className="divide-y divide-gray-50">
                  {scripts.map((script) => (
                    <div key={script.id}>
                      {/* Row summary */}
                      <div
                        className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() =>
                          setExpandedScript(
                            expandedScript === script.id ? null : script.id
                          )
                        }
                      >
                        <div className="col-span-2">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-epic-yellow/10 text-epic-purple font-bold text-sm">
                            {script.word}
                          </span>
                        </div>
                        <div className="col-span-2 text-sm text-epic-purple/70">
                          {script.characterName}
                        </div>
                        <div className="col-span-2">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${settingColor(
                              script.setting
                            )}`}
                          >
                            {script.setting}
                          </span>
                        </div>
                        <div className="col-span-1">
                          {script.colorCategory && (
                            <span
                              className="inline-block w-5 h-5 rounded-md border border-gray-200"
                              style={{ background: script.bgColor || "#EDE9FE" }}
                              title={script.colorCategory}
                            />
                          )}
                        </div>
                        <div className="col-span-2 text-sm text-epic-purple/50 truncate">
                          {script.script.slice(0, 60)}…
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyScript(script);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-epic-blue/10 text-epic-blue hover:bg-epic-blue/20 transition-colors"
                          >
                            {copiedId === script.id ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                {t("prompt.copied")}
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                {t("prompt.copy")}
                              </>
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

                      {/* Expanded detail */}
                      {expandedScript === script.id && (
                        <div className="px-6 pb-5 bg-gray-50/30">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            {/* Script */}
                            <div className="lg:col-span-2 space-y-3">
                              <h4 className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider">
                                {t("prompt.fullScript")}
                              </h4>
                              <div className="rounded-xl bg-white border border-gray-100 p-5 text-sm text-epic-purple/80 leading-relaxed whitespace-pre-wrap font-mono">
                                {script.script}
                              </div>
                            </div>

                            {/* Sidebar info */}
                            <div className="space-y-4">
                              {/* Narrator — separate copyable block */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider">
                                    {t("prompt.narratorLines")}
                                  </h4>
                                  <button
                                    onClick={() => copyNarrator(script)}
                                    className="flex items-center gap-1 text-xs font-medium text-epic-blue hover:text-epic-blue/80 transition-colors"
                                  >
                                    {copiedId === `narrator-${script.id}` ? (
                                      <>
                                        <Check className="w-3 h-3" />
                                        Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        Copy Lines
                                      </>
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

                              {/* Color category */}
                              {script.colorCategory && (
                                <div>
                                  <h4 className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider mb-2">
                                    Color Palette
                                  </h4>
                                  <div className="rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                                    <div
                                      className="w-10 h-10 rounded-lg border border-gray-200"
                                      style={{ background: script.bgColor || "#EDE9FE" }}
                                    />
                                    <div>
                                      <p className="text-sm font-medium text-epic-purple">
                                        {script.colorCategory}
                                      </p>
                                      <p className="text-xs text-epic-purple/40">
                                        Auto-mapped from word
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Background */}
                              <div>
                                <h4 className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider mb-2">
                                  {t("prompt.background")}
                                </h4>
                                <div className="rounded-xl bg-white border border-gray-100 p-4 text-sm text-epic-purple/70">
                                  {script.background}
                                </div>
                              </div>

                              {/* Negative prompt */}
                              <div>
                                <h4 className="text-xs font-semibold text-epic-purple/50 uppercase tracking-wider mb-2">
                                  {t("prompt.negPrompt")}
                                </h4>
                                <div className="rounded-xl bg-red-50/50 border border-red-100/50 p-4 text-sm text-red-600/70 font-mono">
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

            {/* Empty state */}
            {scripts.length === 0 && !generating && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-epic-purple/5 flex items-center justify-center mb-4">
                  <Scroll className="w-8 h-8 text-epic-purple/20" />
                </div>
                <p className="text-sm text-epic-purple/40 font-medium">
                  {t("prompt.emptyState")}
                </p>
                <p className="text-xs text-epic-purple/25 mt-1">
                  {t("prompt.emptyHint")}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
