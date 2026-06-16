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

export async function POST(request: Request) {
    try {
        const { key } = await request.json();
        if (!key) {
            return NextResponse.json({ error: "No key provided" }, { status: 400 });
        }

        const emailExtractorUrl = process.env.EMAIL_EXTRACTOR_URL;
        if (emailExtractorUrl) {
            const baseUrl = emailExtractorUrl.replace(/\/$/, "");
            
            // Check if key is already there first by getting current licenses
            const getRes = await fetch(`${baseUrl}/api/license`, {
                headers: {
                    "x-admin-password": "COZY-ADMIN-2026",
                    "Content-Type": "application/json"
                }
            });
            
            if (getRes.ok) {
                const licenses = await getRes.json();
                const exists = licenses.some((l: any) => l.key === key);
                if (exists) {
                    return NextResponse.json({ success: true, message: "Key already exists on remote" });
                }
            }

            // Put it on the remote server
            const res = await fetch(`${baseUrl}/api/license`, {
                method: "PUT",
                headers: {
                    "x-admin-password": "COZY-ADMIN-2026",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    key,
                    label: "Saved Key"
                })
            });
            if (!res.ok) {
                throw new Error(`Email Extractor API responded with status ${res.status}`);
            }
            return NextResponse.json({ success: true });
        }

        // Local storage fallback
        ensureLicenseFile();
        const fileContent = fs.readFileSync(LICENSE_FILE, "utf-8");
        const licenses = JSON.parse(fileContent);

        // Check if key is already in the file
        const exists = licenses.some((l: any) => l.key === key);
        if (!exists) {
            licenses.push({
                key,
                label: "Saved Key",
                createdAt: new Date().toISOString()
            });
            fs.writeFileSync(LICENSE_FILE, JSON.stringify(licenses, null, 2));
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
