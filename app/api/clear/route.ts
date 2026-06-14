import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
    const files = [
        "tmp_urls.txt",
        "email_extraction_partial.json",
        "email_results_full.json",
        "email_results_successful.json",
        "email_results.csv",
        "websites_with_emails.txt"
    ];

    try {
        for (const file of files) {
            const fullPath = path.join(process.cwd(), file);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Error clearing files:", err);
        return NextResponse.json({ error: "Failed to clear files" }, { status: 500 });
    }
}
