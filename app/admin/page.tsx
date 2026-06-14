"use client";

import { useState, useEffect } from "react";
import { Shield, Key, Plus, Trash2, Copy, Check, LogOut, Layout, Clock, User } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function AdminPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminKey, setAdminKey] = useState("");
    const [error, setError] = useState("");
    const [licenses, setLicenses] = useState<any[]>([]);
    const [newLabel, setNewLabel] = useState("");
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const handleAdminLogin = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (adminKey === "COZY-ADMIN-2026") {
            setIsAdmin(true);
            localStorage.setItem("cozy_admin_auth", "true");
            fetchLicenses();
        } else {
            setError("Invalid Admin Password");
        }
    };

    const fetchLicenses = async () => {
        try {
            const res = await fetch("/api/license", {
                headers: { "x-admin-password": "COZY-ADMIN-2026" }
            });
            const data = await res.json();
            setLicenses(data);
        } catch (err) {
            console.error("Failed to fetch licenses:", err);
        }
    };

    const createLicense = async () => {
        try {
            const res = await fetch("/api/license", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-password": "COZY-ADMIN-2026"
                },
                body: JSON.stringify({ label: newLabel })
            });
            const data = await res.json();
            setLicenses(prev => [...prev, data]);
            setNewLabel("");
        } catch (err) {
            console.error("Failed to create license:", err);
        }
    };

    const revokeLicense = async (key: string) => {
        if (key === "COZY-DARK-2026") return;
        if (!confirm("Are you sure you want to revoke this license?")) return;

        try {
            await fetch("/api/license", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-password": "COZY-ADMIN-2026"
                },
                body: JSON.stringify({ key })
            });
            setLicenses(prev => prev.filter(l => l.key !== key));
        } catch (err) {
            console.error("Failed to revoke license:", err);
        }
    };

    const copyToClipboard = (key: string) => {
        navigator.clipboard.writeText(key);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    useEffect(() => {
        if (localStorage.getItem("cozy_admin_auth") === "true") {
            setIsAdmin(true);
            fetchLicenses();
        }
    }, []);

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="text-center space-y-4">
                        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                            <div className="absolute inset-0 bg-purple-600/20 rounded-2xl border border-purple-500/30 blur-sm" />
                            <Shield className="relative w-10 h-10 text-purple-400" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">ADMIN PORTAL</h1>
                        <p className="text-gray-500 text-sm">Enter Master Password to manage licenses</p>
                    </div>

                    <form onSubmit={handleAdminLogin} className="glass rounded-3xl p-8 space-y-6">
                        <div className="space-y-2">
                            <input
                                type="password"
                                value={adminKey}
                                onChange={(e) => setAdminKey(e.target.value)}
                                placeholder="Master Password..."
                                className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-all font-mono text-sm"
                                autoFocus
                            />
                            {error && <p className="text-xs text-red-400 px-2">{error}</p>}
                        </div>
                        <button type="submit" className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl font-bold transition-all shadow-xl shadow-purple-600/20 active:scale-[0.98]">
                            Enter Dashboard
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 lg:p-12">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-600/20 rounded-2xl border border-purple-500/30">
                            <Shield className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">License Manager</h1>
                            <p className="text-gray-500 text-sm italic">Manage customer access keys</p>
                        </div>
                    </div>

                    <button
                        onClick={() => { setIsAdmin(false); localStorage.removeItem("cozy_admin_auth"); }}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 transition-all text-sm font-semibold text-gray-400 hover:text-red-400"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </header>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left: Creator */}
                    <div className="space-y-6">
                        <div className="glass rounded-3xl p-8 space-y-6">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                <Plus className="w-5 h-5 text-purple-400" />
                                <h2 className="font-semibold">Generate New Key</h2>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-500 uppercase font-bold tracking-wider px-1">Customer Label</label>
                                    <input
                                        type="text"
                                        value={newLabel}
                                        onChange={(e) => setNewLabel(e.target.value)}
                                        placeholder="e.g. John Doe / Client A"
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-5 outline-none focus:border-purple-500/30 transition-all text-sm"
                                    />
                                </div>
                                <button
                                    onClick={createLicense}
                                    className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl font-bold transition-all shadow-lg shadow-purple-600/20"
                                >
                                    Generate License Key
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: List */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="glass rounded-3xl p-8 space-y-6">
                            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <Key className="w-5 h-5 text-blue-400" />
                                    <h2 className="font-semibold">Active Licenses ({licenses.length})</h2>
                                </div>
                            </div>

                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                {licenses.map((license) => (
                                    <div key={license.key} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-purple-500/20 hover:bg-white/[0.04] transition-all group">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="space-y-1.5 flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 font-mono border border-blue-500/20">
                                                        {license.key}
                                                    </span>
                                                    <button
                                                        onClick={() => copyToClipboard(license.key)}
                                                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 transition-all"
                                                    >
                                                        {copiedKey === license.key ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-4 text-[11px] text-gray-500">
                                                    <div className="flex items-center gap-1">
                                                        <User className="w-3 h-3" /> {license.label}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> {new Date(license.createdAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>

                                            {license.key !== "COZY-DARK-2026" && (
                                                <button
                                                    onClick={() => revokeLicense(license.key)}
                                                    className="p-2.5 rounded-xl bg-red-500/5 text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .glass {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
            `}</style>
        </div>
    );
}
