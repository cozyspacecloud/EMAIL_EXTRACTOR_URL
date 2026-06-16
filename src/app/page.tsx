"use client";

import { useState, useCallback, useEffect } from "react";

export default function LicenseGenerator() {
  const [key, setKey] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedKeys, setSavedKeys] = useState<string[]>([]);

  // Load history and saved keys from localStorage on mount
  useEffect(() => {
    const fetchHistory = async () => {
      let parsedSaved: string[] = [];
      try {
        const localSaved = localStorage.getItem("cozy_saved_keys");
        parsedSaved = localSaved ? JSON.parse(localSaved) : [];
        setSavedKeys(parsedSaved);
      } catch (e) {
        console.error("Failed to parse saved keys", e);
      }

      try {
        const res = await fetch("/api/history");
        const data = await res.json();
        if (data.history) {
          // Merge server history with locally saved keys to ensure persistence
          const merged = Array.from(new Set([...data.history, ...parsedSaved]));
          setHistory(merged);

          // Auto-sync any saved keys back to the server if they are missing
          const missingFromServer = parsedSaved.filter((k) => !data.history.includes(k));
          for (const missingKey of missingFromServer) {
            try {
              await fetch("/api/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: missingKey })
              });
              console.log(`Auto-synced saved key back to server: ${missingKey}`);
            } catch (err) {
              console.error(`Failed to auto-sync key ${missingKey}:`, err);
            }
          }
        } else {
          setHistory(parsedSaved);
        }
      } catch (e) {
        console.error("Failed to fetch history", e);
        setHistory(parsedSaved);
      }
    };
    fetchHistory();
  }, []);

  const toggleSaveKey = useCallback((keyToSave: string) => {
    let willBeSaved = false;
    setSavedKeys((prev) => {
      const isSaved = prev.includes(keyToSave);
      willBeSaved = !isSaved;
      const updated = isSaved ? prev.filter((k) => k !== keyToSave) : [...prev, keyToSave];
      try {
        localStorage.setItem("cozy_saved_keys", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to write saved keys to localStorage", e);
      }
      return updated;
    });

    // Ensure the key stays visible in history
    setHistory((prev) => {
      if (!prev.includes(keyToSave)) {
        return [keyToSave, ...prev];
      }
      return prev;
    });

    // Sync saved key with backend database immediately when saved
    if (willBeSaved) {
      fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyToSave })
      }).catch((err) => {
        console.error("Failed to sync key on save:", err);
      });
    }
  }, []);

  const generateKey = useCallback(async () => {
    setIsGenerating(true);
    setCopied(false);

    try {
      // Premium feel delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      const res = await fetch("/api/generate", { method: "POST" });
      const data = await res.json();
      if (data.key) {
        setKey(data.key);
        // Refresh history from backend
        const histRes = await fetch("/api/history");
        const histData = await histRes.json();
        if (histData.history) {
          let parsedSaved: string[] = [];
          try {
            const localSaved = localStorage.getItem("cozy_saved_keys");
            parsedSaved = localSaved ? JSON.parse(localSaved) : [];
          } catch (e) {}
          const merged = Array.from(new Set([...histData.history, ...parsedSaved]));
          setHistory(merged);
        }
      }
    } catch (err) {
      console.error("Failed to generate key", err);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  const deleteKey = useCallback(async (indexToDelete: number) => {
    const keyToDelete = history[indexToDelete];
    if (!keyToDelete) return;

    // Remove from saved keys if it was saved
    setSavedKeys((prev) => {
      const updated = prev.filter((k) => k !== keyToDelete);
      try {
        localStorage.setItem("cozy_saved_keys", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Optimistic UI update
    const updatedHistory = history.filter((_, index) => index !== indexToDelete);
    setHistory(updatedHistory);

    try {
      await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyToDelete }),
      });
      // Fetch latest history to sync just in case
      const res = await fetch("/api/history");
      const data = await res.json();
      if (data.history) {
        let parsedSaved: string[] = [];
        try {
          const localSaved = localStorage.getItem("cozy_saved_keys");
          parsedSaved = localSaved ? JSON.parse(localSaved) : [];
        } catch (e) {}
        const merged = Array.from(new Set([...data.history, ...parsedSaved]));
        setHistory(merged);
      }
    } catch (err) {
      console.error("Failed to delete key", err);
    }
  }, [history]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="glow-bg top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20" />
      <div className="glow-bg bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20" />

      <div className="z-10 w-full max-w-xl animate-float">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter glow-text bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
            COZYSPACECLOUD
          </h1>
          <p className="text-slate-400 mt-2 text-sm md:text-base font-inter tracking-widest uppercase">
            License Key System v2.0
          </p>
        </div>

        {/* Main Generator Card */}
        <div className="glass-card rounded-3xl p-6 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-transparent to-purple-500 opacity-50" />

          <div className="space-y-6">
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Generated License Key
              </label>
              <div className="relative group">
                <input
                  type="text"
                  readOnly
                  value={key || "---- ---- ---- ----"}
                  placeholder=""
                  className={`w-full bg-slate-900/50 border ${key ? "border-blue-500/50" : "border-slate-700/50"} rounded-2xl px-6 py-5 text-xl md:text-2xl font-mono text-center tracking-[0.2em] focus:outline-none transition-all duration-300 ${key ? "text-cyan-400" : "text-slate-600"}`}
                />
                {key && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-slate-900/80 backdrop-blur-md pl-2 pr-1 py-1 rounded-xl border border-slate-800/50">
                    <button
                      onClick={() => copyToClipboard(key)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors group-hover:scale-110 active:scale-95"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => toggleSaveKey(key)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors group-hover:scale-110 active:scale-95"
                      title={savedKeys.includes(key) ? "Unsave Key" : "Save Key"}
                    >
                      {savedKeys.includes(key) ? (
                        <svg className="w-6 h-6 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={generateKey}
              disabled={isGenerating}
              className="w-full relative group overflow-hidden rounded-2xl p-[1px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              <div className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#3b82f6_0%,#a855f7_50%,#3b82f6_100%)]" />
              <div className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-2xl bg-slate-950 px-8 py-4 text-lg font-bold text-white backdrop-blur-3xl transition-all group-hover:bg-slate-950/50">
                {isGenerating ? (
                  <span className="flex items-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    GENRATING...
                  </span>
                ) : (
                  "GENERATE SECURE KEY"
                )}
              </div>
            </button>
          </div>

          {/* History Section */}
          {history.length > 0 && (
            <div className="mt-10 border-t border-slate-800 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 ml-1">
                Recent Generations
              </h3>
              <div className="grid gap-3">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/30 border border-slate-800/50 hover:bg-slate-900/50 transition-colors group">
                    <span className="font-mono text-sm text-slate-400 group-hover:text-cyan-400 transition-colors">{h}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => copyToClipboard(h)}
                        className="text-slate-500 hover:text-white transition-colors"
                        title="Copy Key"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteKey(i)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                        title="Delete Key"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <button
                        onClick={() => toggleSaveKey(h)}
                        className="transition-colors duration-200"
                        title={savedKeys.includes(h) ? "Unsave Key" : "Save Key"}
                      >
                        {savedKeys.includes(h) ? (
                          <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-slate-500 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <p className="mt-8 text-center text-slate-500 text-xs font-inter tracking-wide opacity-50">
          POWERED BY COZYSPACECLOUD ENGINE &copy; 2026. ALL RIGHTS RESERVED.
        </p>
      </div>
    </main>
  );
}
