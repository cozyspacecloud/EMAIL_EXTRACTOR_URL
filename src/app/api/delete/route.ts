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
            const res = await fetch(`${baseUrl}/api/license`, {
                method: "DELETE",
                headers: {
                    "x-admin-password": "COZY-ADMIN-2026",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ key })
            });
            if (!res.ok) {
                throw new Error(`Email Extractor API responded with status ${res.status}`);
            }
            return NextResponse.json({ success: true });
        }

        ensureLicenseFile();

        const fileContent = fs.readFileSync(LICENSE_FILE, "utf-8");
        const licenses = JSON.parse(fileContent);

        // Filter out the deleted key
        const updated = licenses.filter((l: any) => l.key !== key);

        fs.writeFileSync(LICENSE_FILE, JSON.stringify(updated, null, 2));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
