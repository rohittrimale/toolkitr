import { NextRequest, NextResponse } from "next/server";
import { readdir, stat, unlink, rename, copyFile, mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const BASE_PATH = process.env.FILE_DOWNLOAD_PATH || "/tmp";

// ── Helpers ────────────────────────────────────────────────────────────────

interface FileEntry {
  name: string;
  size: number;
  format: string;
  createdAt: string;
  isDirectory: boolean;
}

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv",
  ".json": "application/json",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".log": "text/plain",
};

function getFormat(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "pdf", ".docx": "docx", ".xlsx": "xlsx", ".pptx": "pptx",
    ".md": "md", ".csv": "csv", ".json": "json", ".txt": "txt",
    ".cob": "cob", ".cbl": "cob", ".jcl": "jcl", ".sql": "sql",
    ".js": "js", ".ts": "ts", ".tsx": "tsx", ".jsx": "jsx",
    ".html": "html", ".css": "css", ".py": "py", ".java": "java",
    ".xml": "xml", ".yaml": "yaml", ".yml": "yaml", ".log": "log",
  };
  return map[ext] || "unknown";
}

function getContentType(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

function safePath(name: string): string | null {
  const fullPath = path.join(BASE_PATH, name);
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(BASE_PATH))) return null;
  return resolved;
}

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_").substring(0, 100);
}

function fileToEntry(name: string, s: { size: number; mtime: Date; isDirectory(): boolean }): FileEntry {
  return {
    name,
    size: s.size,
    format: s.isDirectory() ? "folder" : getFormat(name),
    createdAt: s.mtime.toISOString(),
    isDirectory: s.isDirectory(),
  };
}

// ── GET: List, read content, or download ───────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const download = req.nextUrl.searchParams.get("download");
    const name = req.nextUrl.searchParams.get("name");
    const content = req.nextUrl.searchParams.get("content");

    // Download file as blob
    if (download) {
      const resolved = safePath(download);
      if (!resolved || !existsSync(resolved)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      const s = await stat(resolved);
      if (s.isDirectory()) {
        return NextResponse.json({ error: "Cannot download directory" }, { status: 400 });
      }
      const buffer = await readFile(resolved);
      const contentType = getContentType(download);

      // Use "inline" for viewable types (PDF, images), "attachment" for others
      const inlineTypes = ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/webp", "image/bmp"];
      const disposition = inlineTypes.includes(contentType) ? "inline" : "attachment";

      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `${disposition}; filename="${encodeURIComponent(download)}"`,
          "Content-Length": String(s.size),
        },
      });
    }

    // Read single file content as text
    if (name && content === "true") {
      const resolved = safePath(name);
      if (!resolved || !existsSync(resolved)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      const s = await stat(resolved);
      if (s.isDirectory()) {
        return NextResponse.json({ error: "Cannot read directory" }, { status: 400 });
      }
      const textFormats = ["md", "csv", "json", "txt", "cob", "jcl", "sql", "js", "ts", "tsx", "jsx", "html", "css", "py", "java", "xml", "yaml", "log"];
      const format = getFormat(name);
      if (!textFormats.includes(format)) {
        return NextResponse.json({ error: "Binary file - cannot read as text" }, { status: 400 });
      }
      const fileContent = await readFile(resolved, "utf-8");
      return NextResponse.json({ name, content: fileContent, format, size: s.size });
    }

    // List directory
    if (!existsSync(BASE_PATH)) {
      return NextResponse.json({ files: [], count: 0 });
    }

    const entries = await readdir(BASE_PATH);
    const files: FileEntry[] = [];

    for (const entryName of entries) {
      try {
        const fullPath = path.join(BASE_PATH, entryName);
        const s = await stat(fullPath);
        files.push(fileToEntry(entryName, s));
      } catch { /* skip */ }
    }

    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return NextResponse.json({ files, count: files.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list files" },
      { status: 500 }
    );
  }
}

// ── POST: Create, rename, copy, or upload ──────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Handle file upload (multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      if (!existsSync(BASE_PATH)) await mkdir(BASE_PATH, { recursive: true });

      // Handle duplicate names: add _1, _2, etc.
      let finalName = sanitize(file.name);
      let counter = 1;
      const ext = path.extname(finalName);
      const base = path.basename(finalName, ext);
      while (existsSync(path.join(BASE_PATH, finalName))) {
        finalName = `${base}_${counter}${ext}`;
        counter++;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(BASE_PATH, finalName);
      await writeFile(filePath, buffer);

      const s = await stat(filePath);
      return NextResponse.json({
        success: true,
        file: fileToEntry(finalName, s),
      });
    }

    // Handle JSON actions
    const body = await req.json() as {
      action: "create" | "folder" | "rename" | "copy" | "write";
      name?: string;
      newName?: string;
      content?: string;
      format?: string;
    };

    const { action } = body;

    // Write/edit existing file content
    if (action === "write") {
      const { name, content = "" } = body;
      if (!name) return NextResponse.json({ error: "Missing file name" }, { status: 400 });

      const resolved = safePath(name);
      if (!resolved) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

      await writeFile(resolved, content, "utf-8");
      const s = await stat(resolved);
      return NextResponse.json({
        success: true,
        file: fileToEntry(name, s),
      });
    }

    if (action === "create") {
      const { name, content = "", format = "txt" } = body;
      if (!name) return NextResponse.json({ error: "Missing file name" }, { status: 400 });

      const safeName = sanitize(name);
      const ext = `.${format}`;
      const fullName = safeName.endsWith(ext) ? safeName : `${safeName}${ext}`;
      const resolved = safePath(fullName);
      if (!resolved) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

      if (!existsSync(BASE_PATH)) await mkdir(BASE_PATH, { recursive: true });
      await writeFile(resolved, content, "utf-8");

      const s = await stat(resolved);
      return NextResponse.json({
        success: true,
        file: fileToEntry(fullName, s),
      });
    }

    if (action === "folder") {
      const { name } = body;
      if (!name) return NextResponse.json({ error: "Missing folder name" }, { status: 400 });

      const safeName = sanitize(name);
      const resolved = safePath(safeName);
      if (!resolved) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

      await mkdir(resolved, { recursive: true });
      return NextResponse.json({ success: true, message: `Created folder ${safeName}` });
    }

    if (action === "rename") {
      const { name, newName } = body;
      if (!name || !newName) return NextResponse.json({ error: "Missing name or newName" }, { status: 400 });

      const oldResolved = safePath(name);
      const newResolved = safePath(sanitize(newName));
      if (!oldResolved || !newResolved) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
      if (!existsSync(oldResolved)) return NextResponse.json({ error: "File not found" }, { status: 404 });

      await rename(oldResolved, newResolved);
      const s = await stat(newResolved);
      return NextResponse.json({
        success: true,
        file: fileToEntry(path.basename(newResolved), s),
      });
    }

    if (action === "copy") {
      const { name, newName } = body;
      if (!name || !newName) return NextResponse.json({ error: "Missing name or newName" }, { status: 400 });

      const srcResolved = safePath(name);
      const destResolved = safePath(sanitize(newName));
      if (!srcResolved || !destResolved) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
      if (!existsSync(srcResolved)) return NextResponse.json({ error: "File not found" }, { status: 404 });

      await copyFile(srcResolved, destResolved);
      const s = await stat(destResolved);
      return NextResponse.json({
        success: true,
        file: fileToEntry(path.basename(destResolved), s),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Operation failed" },
      { status: 500 }
    );
  }
}

// ── DELETE: Delete file or folder ──────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get("name");
    if (!name) return NextResponse.json({ error: "Missing name parameter" }, { status: 400 });

    const resolved = safePath(name);
    if (!resolved || !existsSync(resolved)) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const s = await stat(resolved);
    if (s.isDirectory()) {
      const { rm } = await import("fs/promises");
      await rm(resolved, { recursive: true, force: true });
    } else {
      await unlink(resolved);
    }

    return NextResponse.json({ success: true, message: `Deleted ${name}` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
