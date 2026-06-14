"use client";

import { useState, useEffect, useRef } from "react";
import { Mail, Search, Globe, Layout, Shield, CheckCircle2, AlertCircle, Play, StopCircle, Terminal, Download, Copy, Upload, X, Lock, LogOut, Key } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- LICENSE VALIDATION LOGIC (CHECKSUM) ---
function verifyLicenseKey(key: string): boolean {
    if (!key) return false;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const parts = key.trim().toUpperCase().split("-");

    if (parts.length !== 4 || parts[0] !== "COZY") return false;

    const s1 = parts[0];
    const s2 = parts[1];
    const s3 = parts[2];
    const s4 = parts[3];

    // Checksum Algorithm (Matches Generator exactly)
    const calculateChecksum = (segments: string[]) => {
        const combined = segments.join("");
        let sum = 0;
        for (let i = 0; i < combined.length; i++) {
            sum += combined.charCodeAt(i);
        }

        let checksum = "";
        for (let i = 0; i < 4; i++) {
            // Must match Generator: (sum + i * 13) % chars.length
            const index = (sum + i * 13) % chars.length;
            checksum += chars.charAt(index);
        }
        return checksum;
    };

    const expectedS4 = calculateChecksum([s1, s2, s3]);
    return s4 === expectedS4;
}

interface Result {
    URL: string;
    EMAILS: string | null;
}

export default function Dashboard() {
    const [urls, setUrls] = useState("");
    const [isExtracting, setIsExtracting] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [stats, setStats] = useState({ total: 0, successful: 0, failed: 0 });
    const logEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showEmailsPanel, setShowEmailsPanel] = useState(false);

    // Authentication States
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [inputKey, setInputKey] = useState("");
    const [loginError, setLoginError] = useState("");

    useEffect(() => {
        const checkAuth = async () => {
            const auth = localStorage.getItem("cozy_auth");
            const savedKey = localStorage.getItem("cozy_license_key");
            if (auth === "true" && savedKey) {
                try {
                    const res = await fetch("/api/license", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key: savedKey }),
                    });
                    const data = await res.json();
                    if (data.valid) {
                        setIsAuthenticated(true);
                        setIsAuthChecking(false);
                        return;
                    }
                } catch (err) {
                    console.error("Auth check failed:", err);
                }
            }
            localStorage.removeItem("cozy_auth");
            localStorage.removeItem("cozy_license_key");
            setIsAuthenticated(false);
            setIsAuthChecking(false);
        };
        checkAuth();
    }, []);

    // Poll to log out immediately if license is deleted from the licenses file
    useEffect(() => {
        if (!isAuthenticated) return;
        
        const interval = setInterval(async () => {
            const auth = localStorage.getItem("cozy_auth");
            const savedKey = localStorage.getItem("cozy_license_key");
            
            if (!auth || !savedKey) {
                setIsAuthenticated(false);
                localStorage.removeItem("cozy_auth");
                localStorage.removeItem("cozy_license_key");
                setInputKey("");
                return;
            }

            try {
                const res = await fetch("/api/license", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key: savedKey }),
                });
                const data = await res.json();
                if (!data.valid) {
                    setIsAuthenticated(false);
                    localStorage.removeItem("cozy_auth");
                    localStorage.removeItem("cozy_license_key");
                    setInputKey("");
                }
            } catch (err) {
                console.error("Polling validation failed:", err);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isAuthenticated]);

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setLoginError("");

        // Simulation delay for premium feel
        const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        try {
            await wait(1000); // Verify delay

            // 1. Check if it is the master key or passes the local checksum
            if (inputKey !== "COZY-DARK-2026" && !verifyLicenseKey(inputKey)) {
                setLoginError("Invalid license key. Please try again.");
                return;
            }

            // 2. Validate against server database (licenses.json)
            const res = await fetch("/api/license", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: inputKey }),
            });
            const data = await res.json();

            if (data.valid) {
                setIsAuthenticated(true);
                localStorage.setItem("cozy_auth", "true");
                localStorage.setItem("cozy_license_key", inputKey);
                setLoginError("");
            } else {
                setLoginError("License key not found. Please try again.");
            }
        } catch (err) {
            setLoginError("An error occurred. Please try again.");
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        localStorage.removeItem("cozy_auth");
        localStorage.removeItem("cozy_license_key");
        setInputKey("");
    };

    // ... (rest of the original component logic remains exactly the same)
    const allEmails = results
        .filter(r => r.EMAILS)
        .flatMap(r => r.EMAILS!.split(", "))
        .filter((email, i, arr) => arr.indexOf(email) === i);

    const saveEmailsTxt = () => {
        const blob = new Blob([allEmails.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'emails.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    const saveEmailsCsv = () => {
        let csv = 'EMAIL\n';
        for (const email of allEmails) {
            csv += `${email}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'emails.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyAllEmails = () => {
        navigator.clipboard.writeText(allEmails.join('\n'));
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result as string;
            if (file.name.endsWith('.csv')) {
                const lines = text.split('\n');
                const extracted: string[] = [];
                for (const line of lines) {
                    const cells = line.split(',');
                    for (const cell of cells) {
                        const trimmed = cell.trim().replace(/^"|"$/g, '').trim();
                        if (trimmed && (trimmed.startsWith('http') || trimmed.includes('.'))) {
                            extracted.push(trimmed);
                        }
                    }
                }
                setUrls(extracted.join('\n'));
            } else {
                setUrls(text.trim());
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const exportCSV = () => {
        if (results.length === 0) return;
        let csv = 'URL,EMAILS\n';
        for (const r of results) {
            const emails = r.EMAILS ? `"${r.EMAILS}"` : 'None';
            csv += `"${r.URL}",${emails}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'email_results.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyEmail = (email: string) => {
        navigator.clipboard.writeText(email);
    };

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const clearResults = async () => {
        if (!confirm("Are you sure you want to clear all results? This will also delete the backup files.")) return;
        setResults([]);
        setStats({ total: 0, successful: 0, failed: 0 });
        setLogs(["✨ Results cleared."]);

        try {
            await fetch("/api/clear", { method: "POST" });
        } catch (err) {
            console.error("Failed to clear files:", err);
        }
    };

    const startExtraction = async () => {
        if (!urls.trim()) return;

        setIsExtracting(true);
        setLogs(["🚀 Initializing extraction process..."]);
        setResults([]);
        setStats({ total: 0, successful: 0, failed: 0 });

        try {
            const response = await fetch("/api/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: urls.split("\n").filter(u => u.trim()) }),
            });

            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n").filter(Boolean);

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.type === "log") {
                            setLogs(prev => [...prev, data.message]);
                        } else if (data.type === "result") {
                            setResults(prev => [...prev, data.data]);
                            setStats(prev => ({
                                ...prev,
                                total: prev.total + 1,
                                successful: data.data.EMAILS ? prev.successful + 1 : prev.successful,
                                failed: data.data.EMAILS ? prev.failed : prev.failed + 0
                            }));
                        }
                    } catch {
                        setLogs(prev => [...prev, line]);
                    }
                }
            }
        } catch (err) {
            setLogs(prev => [...prev, `❌ Error: ${err instanceof Error ? err.message : "Extraction failed"}`]);
        } finally {
            setIsExtracting(false);
            setLogs(prev => [...prev, "🏁 Extraction complete."]);
        }
    };

    if (isAuthChecking) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="text-center space-y-4">
                        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                            <div className="absolute inset-0 bg-blue-600/20 rounded-2xl border border-blue-500/30 blur-sm" />
                            <img src="/logo.png" alt="Logo" className="relative w-16 h-16 object-contain" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">PROTECTED ACCESS</h1>
                        <p className="text-gray-500 text-sm">Please enter your license key to continue</p>
                    </div>

                    <form onSubmit={handleLogin} className="glass rounded-3xl p-8 space-y-6">
                        <div className="space-y-2">
                            <div className="relative">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    value={inputKey}
                                    onChange={(e) => setInputKey(e.target.value)}
                                    placeholder="Enter License Key (COZY-XXXX-...)"
                                    className={cn(
                                        "w-full bg-black/40 border rounded-2xl py-4 pl-12 pr-4 outline-none transition-all font-mono text-sm uppercase",
                                        loginError ? "border-red-500/50 focus:ring-red-500/20" : "border-white/5 focus:ring-blue-500/20 focus:border-blue-500/50"
                                    )}
                                    autoFocus
                                />
                            </div>
                            {loginError && (
                                <p className="text-xs text-red-400 flex items-center gap-1.5 px-1">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {loginError}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <Lock className="w-4 h-4" />
                            Unlock Dashboard
                        </button>
                    </form>

                    <div className="text-center">
                        <p className="text-[10px] text-gray-600 font-mono tracking-widest uppercase italic">
                            © 2026 COZYSPACECLOUD SECURE SYSTEM
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Main Content
    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 lg:p-12 selection:bg-blue-500/30">
            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
                <div className="absolute top-1/2 -right-24 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px]" />
            </div>

            <main className="relative max-w-7xl mx-auto space-y-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 flex items-center justify-center">
                                <div className="absolute inset-0 bg-blue-600/20 rounded-lg border border-blue-500/30 blur-sm" />
                                <img src="/logo.png" alt="COZYSPACECLOUD Logo" className="relative w-10 h-10 object-contain rounded-lg" />
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                                COZYSPACECLOUD EMAIL EXTRACTOR PRO
                            </h1>
                        </div>
                        <p className="text-gray-400 max-w-md">High-precision email mining with Lite 1.4 automation.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button onClick={handleLogout} className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 transition-all text-gray-500 hover:text-red-400 group" title="Logout / Lock"><LogOut className="w-5 h-5" /></button>
                        <div className="glass px-4 py-2 rounded-xl flex items-center gap-3">
                            <div className="text-center">
                                <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Processed</div>
                                <div className="text-xl font-mono">{stats.total}</div>
                            </div>
                            <div className="w-px h-8 bg-gray-800" />
                            <div className="text-center cursor-pointer hover:bg-green-500/10 rounded-lg px-2 py-1 transition-all" onClick={() => { if (allEmails.length > 0) setShowEmailsPanel(true); }} title="Click to view all emails">
                                <div className="text-xs text-green-400 uppercase font-bold tracking-wider">Found</div>
                                <div className="text-xl font-mono">{stats.successful}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-7 space-y-8">
                        <div className="glass rounded-3xl p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2"><Globe className="w-5 h-5 text-blue-400" /><h2 className="text-lg font-semibold">Target Websites</h2></div>
                                <span className="text-xs text-gray-500 font-mono">one URL per line</span>
                            </div>
                            <input ref={fileInputRef} type="file" accept=".txt,.csv" onChange={handleFileImport} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all text-sm text-gray-300"><Upload className="w-4 h-4 text-blue-400" />Import File</button>
                            <textarea value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://example.com" className="w-full h-48 bg-black/40 border border-white/5 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all outline-none resize-none font-mono text-sm" />
                            <button onClick={startExtraction} disabled={isExtracting || !urls.trim()} className={cn("w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2", isExtracting ? "bg-gray-800 text-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 active:scale-[0.98] shadow-lg shadow-blue-600/20")}>{isExtracting ? (<><div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />Extracting Emails...</>) : (<><Play className="w-5 h-5 fill-current" />Start Extraction</>)}</button>
                        </div>
                        <div className="glass rounded-3xl overflow-hidden">
                            <div className="bg-white/5 px-6 py-3 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2"><Terminal className="w-4 h-4 text-gray-400" /><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live Output</span></div>
                            </div>
                            <div className="h-[300px] overflow-y-auto p-6 font-mono text-xs space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">{logs.length === 0 && <span className="text-gray-600 italic">Idle. Waiting for input...</span>}{logs.map((log, i) => (<div key={i} className={cn("flex gap-3", log.includes("❌") ? "text-red-400" : log.includes("✅") || log.includes("✨") ? "text-green-400" : log.includes("🌐") ? "text-blue-400" : "text-gray-400")}><span className="text-gray-700 shrink-0 select-none">[{i + 1}]</span><span className="break-all">{log}</span></div>))}<div ref={logEndRef} /></div>
                        </div>
                    </div>
                    <div className="lg:col-span-5 space-y-6">
                        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Layout className="w-5 h-5 text-purple-400" /><h2 className="text-lg font-semibold">Extracted Emails</h2></div>{results.length > 0 && (<div className="flex items-center gap-3"><button onClick={clearResults} className="text-xs text-red-400 hover:underline flex items-center gap-1"><X className="w-3 h-3" />Clear</button><div className="w-px h-3 bg-gray-800" /><button onClick={exportCSV} className="text-xs text-blue-400 hover:underline flex items-center gap-1"><Download className="w-3 h-3" />Export CSV</button></div>)}</div>
                        <div className="space-y-4 max-h-[720px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">{results.length === 0 && (<div className="glass rounded-3xl p-12 text-center space-y-4"><div className="w-16 h-16 bg-gray-800/30 rounded-full flex items-center justify-center mx-auto border border-white/5"><Search className="w-8 h-8 text-gray-600" /></div><p className="text-gray-500 text-sm">No results yet. Start an extraction to see data here.</p></div>)}{results.slice(-200).reverse().map((res, i) => (<div key={i} className="glass rounded-2xl p-5 group hover:border-blue-500/30 hover:bg-white/[0.05] transition-all animate-in fade-in slide-in-from-right-4 duration-500"><div className="flex items-start justify-between gap-4"><div className="space-y-2 overflow-hidden"><div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-gray-500 shrink-0" /><span className="text-sm font-medium text-gray-300 truncate">{res.URL}</span></div>{res.EMAILS ? (<div className="flex flex-wrap gap-2 pt-1">{res.EMAILS.split(", ").map((email, ei) => (<div key={ei} className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2 group/email"><span className="text-xs font-mono text-blue-300">{email}</span><Copy onClick={() => copyEmail(email)} className="w-3 h-3 text-blue-600 group-hover/email:text-blue-400 cursor-pointer" /></div>))}</div>) : (<div className="px-3 py-1 bg-red-500/5 border border-red-500/10 rounded-lg w-fit"><span className="text-xs font-mono text-red-400/60">No emails found</span></div>)}</div><div className={cn("shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", res.EMAILS ? "bg-green-500/10 border border-green-500/20" : "bg-gray-800/30 border border-white/5")}>{res.EMAILS ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-gray-600" />}</div></div></div>))}</div>
                    </div>
                </div>
            </main>

            <footer className="mt-20 py-8 border-t border-white/5 relative z-10 text-center"><p className="text-gray-500 text-xs font-mono tracking-widest flex items-center justify-center gap-2"><Shield className="w-3 h-3" />POWERED BY LITE 1.4 AUTOMATION</p></footer>

            {showEmailsPanel && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowEmailsPanel(false)}><div className="glass rounded-3xl p-8 w-full max-w-lg max-h-[80vh] flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Mail className="w-5 h-5 text-green-400" /><h2 className="text-lg font-semibold">Extracted Emails ({allEmails.length})</h2></div><button onClick={() => setShowEmailsPanel(false)} className="p-1 rounded-lg hover:bg-white/10 transition-all"><X className="w-5 h-5 text-gray-400" /></button></div><div className="flex gap-2"><button onClick={saveEmailsTxt} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 transition-all text-sm font-semibold"><Download className="w-4 h-4" /> Save .txt</button><button onClick={saveEmailsCsv} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 transition-all text-sm font-semibold"><Download className="w-4 h-4" /> Save .csv</button><button onClick={copyAllEmails} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm text-gray-300"><Copy className="w-4 h-4" /> Copy All</button></div><div className="overflow-y-auto flex-1 space-y-1.5 pr-2 scrollbar-thin scrollbar-thumb-white/10">{allEmails.map((email, i) => (<div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-green-500/20 hover:bg-white/[0.06] transition-all group"><span className="text-sm font-mono text-green-300">{email}</span><Copy onClick={() => copyEmail(email)} className="w-3.5 h-3.5 text-gray-600 group-hover:text-green-400 cursor-pointer transition-colors" /></div>))}</div></div></div>)}
        </div>
    );
}

