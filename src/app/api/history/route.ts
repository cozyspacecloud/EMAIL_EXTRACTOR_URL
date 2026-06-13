import { NextResponse } from "next/server";
import path from "path";
import os from "os";
import fs from "fs";

const LICENSE_FILE = path.join(os.homedir(), "Documents", "URL EXTRACTOR", "COZY SPACE CLOUD EMAIL EXTRACTOR", "licenses.json");

function ensureLicenseFile() {
    if (!fs.existsSync(LICENSE_FILE)) {
        const dir = path.dirname(LICENSE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(LICENSE_FILE, JSON.stringify([
            { key: "COZY-DARK-2026", label: "Master Key", createdAt: new Date().toISOString() }
        ], null, 2));
    }
}

export async function GET() {
    try {
        const emailExtractorUrl = process.env.EMAIL_EXTRACTOR_URL;
        if (emailExtractorUrl) {
            const baseUrl = emailExtractorUrl.replace(/\/$/, "");
            const res = await fetch(`${baseUrl}/api/license`, {
                headers: {
                    "x-admin-password": "COZY-ADMIN-2026",
                    "Content-Type": "application/json"
                }
            });
            if (!res.ok) {
                throw new Error(`Email Extractor API responded with status ${res.status}`);
            }
            const licenses = await res.json();
            const history = licenses
                .filter((l: any) => l.key !== "COZY-DARK-2026")
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((l: any) => l.key);
            
            return NextResponse.json({ history });
        }

        ensureLicenseFile();
        const fileContent = fs.readFileSync(LICENSE_FILE, "utf-8");
        const licenses = JSON.parse(fileContent);
        // Exclude the master key from history display
        const history = licenses
            .filter((l: any) => l.key !== "COZY-DARK-2026")
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((l: any) => l.key);
        
        return NextResponse.json({ history });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
