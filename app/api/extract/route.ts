import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls)) {
        return NextResponse.json({ error: "Invalid URLs" }, { status: 400 });
    }

    // Clean up temporary URL file
    const tmpFile = path.join(process.cwd(), "tmp_urls.txt");

    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);

    // Create temporary URL file
    fs.writeFileSync(tmpFile, urls.join("\n"));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            // Spawn Python process
            const pythonCmd = process.platform === "win32" ? "py" : "python3";
            const pythonProcess = spawn(pythonCmd, ["email.py", tmpFile], {
                cwd: process.cwd(),
                env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" }
            });

            pythonProcess.stdout.on("data", (data) => {
                const lines = data.toString().split("\n");
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;

                    // 1. Check for RESULT prefix (streamed result from Python script)
                    if (trimmedLine.startsWith("RESULT: ")) {
                        try {
                            const resultData = JSON.parse(trimmedLine.substring(8));
                            controller.enqueue(encoder.encode(JSON.stringify({ type: "result", data: resultData }) + "\n"));
                        } catch (err) {
                            // Ignore JSON parsing errors
                        }
                        continue;
                    }

                    // 2. Check for processing logs
                    if (trimmedLine.includes("🔍 Processing") || trimmedLine.includes("🌐") || trimmedLine.includes("loading contact") || trimmedLine.includes("copy all") || trimmedLine.includes("paste in") || trimmedLine.includes("inspecting") || trimmedLine.includes("then extract")) {
                        controller.enqueue(encoder.encode(JSON.stringify({ type: "log", message: trimmedLine }) + "\n"));
                    }

                    // 3. Watch for progress logs
                    if (trimmedLine.includes("Progress:")) {
                        controller.enqueue(encoder.encode(JSON.stringify({ type: "log", message: trimmedLine }) + "\n"));
                    }

                    // 4. Catch specific status logs
                    if (trimmedLine.includes("📊 Status") || trimmedLine.includes("🌍 Language") || trimmedLine.includes("⚠️ No emails") || trimmedLine.includes("❌ Error")) {
                        controller.enqueue(encoder.encode(JSON.stringify({ type: "log", message: trimmedLine }) + "\n"));
                    }
                }
            });

            pythonProcess.stderr.on("data", (data) => {
                controller.enqueue(encoder.encode(JSON.stringify({ type: "log", message: `⚠️ ${data.toString().trim()}` }) + "\n"));
            });

            pythonProcess.on("close", (code) => {
                // Clean up
                if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "application/x-ndjson",
            "Cache-Control": "no-cache",
        },
    });
}
