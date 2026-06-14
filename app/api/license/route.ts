import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const LICENSE_FILE = path.join(process.cwd(), "licenses.json");

// Ensure license file exists with the master key
const ensureLicenseFile = () => {
    if (!fs.existsSync(LICENSE_FILE)) {
        fs.writeFileSync(LICENSE_FILE, JSON.stringify([
            { key: "COZY-DARK-2026", label: "Master Key", createdAt: new Date().toISOString() }
        ], null, 2));
    }
};

export async function GET(req: NextRequest) {
    const adminPass = req.headers.get("x-admin-password");
    if (adminPass !== "COZY-ADMIN-2026") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    ensureLicenseFile();
    const licenses = JSON.parse(fs.readFileSync(LICENSE_FILE, "utf-8"));
    return NextResponse.json(licenses);
}

export async function POST(req: NextRequest) {
    const { key } = await req.json();
    ensureLicenseFile();
    const licenses = JSON.parse(fs.readFileSync(LICENSE_FILE, "utf-8"));

    const isValid = licenses.some((l: any) => l.key === key);
    return NextResponse.json({ valid: isValid });
}

export async function PUT(req: NextRequest) {
    const adminPass = req.headers.get("x-admin-password");
    if (adminPass !== "COZY-ADMIN-2026") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { label, key } = await req.json();
    ensureLicenseFile();
    const licenses = JSON.parse(fs.readFileSync(LICENSE_FILE, "utf-8"));

    const newKey = key || `COZY-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const newLicense = {
        key: newKey,
        label: label || "Customer Key",
        createdAt: new Date().toISOString()
    };

    licenses.push(newLicense);
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(licenses, null, 2));

    return NextResponse.json(newLicense);
}

export async function DELETE(req: NextRequest) {
    const adminPass = req.headers.get("x-admin-password");
    if (adminPass !== "COZY-ADMIN-2026") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key } = await req.json();
    if (key === "COZY-DARK-2026") {
        return NextResponse.json({ error: "Cannot delete master key" }, { status: 400 });
    }

    ensureLicenseFile();
    const licenses = JSON.parse(fs.readFileSync(LICENSE_FILE, "utf-8"));
    const updated = licenses.filter((l: any) => l.key !== key);
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(updated, null, 2));

    return NextResponse.json({ success: true });
}
