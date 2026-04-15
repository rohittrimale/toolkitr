// File creation tool definitions for the agentic loop
// These tools allow the AI assistant to create documents on the local machine

export const FILE_TOOL_DEFINITIONS = [
  {
    name: "create_document",
    description: "Create and save a document to the local file system. Supports Word (.docx), Excel (.xlsx), PDF (.pdf), Markdown (.md), CSV (.csv), JSON (.json), Text (.txt), COBOL (.cob), JCL (.jcl), SQL (.sql). Use this after analyzing data to generate formatted reports, documentation, or data exports.",
    parameters: {
      type: "object" as const,
      properties: {
        format: {
          type: "string" as const,
          enum: ["docx", "xlsx", "pdf", "md", "csv", "json", "txt", "cob", "jcl", "sql"],
          description: "File format to generate. docx for Word, xlsx for Excel, pdf for PDF, md for Markdown, csv for spreadsheet data, json for structured data, txt for plain text, cob/jcl/sql for code files."
        },
        title: {
          type: "string" as const,
          description: "Document title (will appear at the top of the document)"
        },
        filename: {
          type: "string" as const,
          description: "Custom filename without extension (optional, will auto-generate from title if not provided)"
        },
        content: {
          type: "string" as const,
          description: "Document content. For md format, use Markdown syntax. For docx/pdf, plain text with # for headings and - for bullets."
        },
        sections: {
          type: "array" as const,
          description: "Optional document sections for structured documents (each with heading and content)",
          items: {
            type: "object" as const,
            properties: {
              heading: { type: "string" as const },
              content: { type: "string" as const }
            }
          }
        },
        table: {
          type: "object" as const,
          description: "Tabular data for Excel or Word tables",
          properties: {
            headers: { type: "array" as const, items: { type: "string" as const } },
            rows: { type: "array" as const, items: { type: "array" as const, items: { type: "string" as const } } }
          }
        },
        sheets: {
          type: "array" as const,
          description: "Multiple sheets for Excel format",
          items: {
            type: "object" as const,
            properties: {
              name: { type: "string" as const },
              headers: { type: "array" as const, items: { type: "string" as const } },
              rows: { type: "array" as const, items: { type: "array" as const, items: { type: "string" as const } } }
            }
          }
        }
      },
      required: ["format", "title", "content"]
    }
  },
  {
    name: "get_file_formats",
    description: "Get information about supported file formats and their use cases",
    parameters: {
      type: "object" as const,
      properties: {},
      required: []
    }
  }
];

export type FileToolName = typeof FILE_TOOL_DEFINITIONS[number]["name"];
