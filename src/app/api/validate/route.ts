import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
        return NextResponse.json({ valid: false, error: "No key provided" }, { status: 400 });
    }

    const parts = key.split("-");
    if (parts.length !== 4 || parts[0] !== "COZY") {
        return NextResponse.json({ valid: false, error: "Invalid format" });
    }

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const s1 = parts[0];
    const s2 = parts[1];
    const s3 = parts[2];
    const s4 = parts[3];

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

    const expectedS4 = calculateChecksum([s1, s2, s3]);
    const isValid = s4 === expectedS4;

    return NextResponse.json({
        valid: isValid,
        key: key,
        timestamp: new Date().toISOString()
    });
}
