import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Allowed save location
const BASE_SAVE_PATH = process.env.FILE_DOWNLOAD_PATH || "/tmp";

interface FileRequest {
  format: "docx" | "xlsx" | "pdf" | "md" | "csv" | "json" | "txt" | "cob" | "jcl" | "sql";
  title: string;
  filename?: string;
  content: string;
  sections?: Array<{ heading: string; content: string }>;
  table?: { headers: string[]; rows: string[][] };
  sheets?: Array<{ name: string; headers: string[]; rows: string[][] }>;
}

// Sanitize filename
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

// Get file extension
function getExtension(format: string): string {
  const extMap: Record<string, string> = {
    docx: ".docx",
    xlsx: ".xlsx",
    pdf: ".pdf",
    md: ".md",
    csv: ".csv",
    json: ".json",
    txt: ".txt",
    cob: ".cob",
    jcl: ".jcl",
    sql: ".sql",
  };
  return extMap[format] || ".txt";
}

// Generate document based on format
async function generateDocument(req: FileRequest): Promise<Buffer> {
  const { format, title, content, sections, table, sheets } = req;

  switch (format) {
    case "docx": {
      const { generateDocx } = await import("@/lib/files/generators/docx");
      return generateDocx(title, content, sections, table);
    }
    case "xlsx": {
      const { generateExcel } = await import("@/lib/files/generators/excel");
      const excelSheets = sheets || [{ name: title, headers: table?.headers || [], rows: table?.rows || [] }];
      return generateExcel(title, excelSheets);
    }
    case "pdf": {
      const { generatePdf } = await import("@/lib/files/generators/pdf");
      return generatePdf(title, content, sections);
    }
    case "md": {
      const { generateMarkdown } = await import("@/lib/files/generators/simple");
      return Buffer.from(generateMarkdown(title, content, sections));
    }
    case "csv": {
      const { generateCsv } = await import("@/lib/files/generators/simple");
      return Buffer.from(generateCsv(table?.headers || ["Content"], table?.rows || [[content]]));
    }
    case "json": {
      const { generateJson } = await import("@/lib/files/generators/simple");
      return Buffer.from(generateJson(title, { content, sections, table }));
    }
    case "cob":
    case "jcl":
    case "sql": {
      const { generateCode } = await import("@/lib/files/generators/simple");
      return Buffer.from(generateCode(content, format));
    }
    case "txt":
    default: {
      const { generateText } = await import("@/lib/files/generators/simple");
      return Buffer.from(generateText(title, content));
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as FileRequest;
    const { format, title, content, filename: customFilename } = body;

    if (!format || !title || !content) {
      return NextResponse.json(
        { error: "Missing required fields: format, title, content" },
        { status: 400 }
      );
    }

    // Ensure save directory exists
    if (!existsSync(BASE_SAVE_PATH)) {
      await mkdir(BASE_SAVE_PATH, { recursive: true });
    }

    // Generate filename
    const safeTitle = sanitizeFilename(customFilename || title);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const finalFilename = `${safeTitle}_${timestamp}${getExtension(format)}`;
    const filePath = path.join(BASE_SAVE_PATH, finalFilename);

    // Generate document
    const buffer = await generateDocument(body);

    // Write file
    await writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      filePath,
      fileName: finalFilename,
      fileSize: buffer.length,
      message: `Document saved to ${filePath}`,
    });
  } catch (err) {
    console.error("[Files/Create] Error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to create file" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "File creation API",
    supportedFormats: ["docx", "xlsx", "pdf", "md", "csv", "json", "txt", "cob", "jcl", "sql"],
    saveLocation: BASE_SAVE_PATH,
  });
}
