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

export async function POST() {
    try {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        const getRandomSegment = () => {
            let str = "";
            for (let i = 0; i < 4; i++) {
                str += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return str;
        };

        const s1 = "COZY";
        const s2 = getRandomSegment();
        const s3 = getRandomSegment();

        // Checksum Algorithm: Sum of char codes modulo chars.length
        const calculateChecksum = (segments: string[]) => {
            const combined = segments.join("");
            let sum = 0;
            for (let i = 0; i < combined.length; i++) {
                sum += combined.charCodeAt(i);
            }

            let checksum = "";
            for (let i = 0; i < 4; i++) {
                const index = (sum + i * 13) % chars.length;
                checksum += chars.charAt(index);
            }
            return checksum;
        };

        const s4 = calculateChecksum([s1, s2, s3]);
        const newKey = `${s1}-${s2}-${s3}-${s4}`;

        const emailExtractorUrl = process.env.EMAIL_EXTRACTOR_URL;
        if (emailExtractorUrl) {
            const baseUrl = emailExtractorUrl.replace(/\/$/, "");
            const res = await fetch(`${baseUrl}/api/license`, {
                method: "PUT",
                headers: {
                    "x-admin-password": "COZY-ADMIN-2026",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    key: newKey,
                    label: "Generated Key"
                })
            });
            if (!res.ok) {
                throw new Error(`Email Extractor API responded with status ${res.status}`);
            }
            return NextResponse.json({ key: newKey });
        }

        ensureLicenseFile();
        const fileContent = fs.readFileSync(LICENSE_FILE, "utf-8");
        const licenses = JSON.parse(fileContent);

        // Add the new license
        licenses.push({
            key: newKey,
            label: "Generated Key",
            createdAt: new Date().toISOString()
        });

        fs.writeFileSync(LICENSE_FILE, JSON.stringify(licenses, null, 2));

        return NextResponse.json({ key: newKey });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
