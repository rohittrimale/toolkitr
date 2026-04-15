'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { X, FileCode, FileText, FileSpreadsheet, FileImage, FileArchive, Terminal as TerminalIcon, Download } from 'lucide-react';
import type { FileEntry } from '@/hooks/useFileSystem';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// ── Helpers ────────────────────────────────────────────────────────────────

function getLanguage(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', java: 'java', cob: 'cobol', cbl: 'cobol',
    html: 'html', htm: 'html', css: 'css', scss: 'scss',
    json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', sql: 'sql',
    sh: 'shell', bash: 'shell', zsh: 'shell',
    bat: 'bat', cmd: 'bat', ps1: 'powershell',
    jcl: 'plaintext', txt: 'plaintext', csv: 'plaintext', log: 'plaintext',
  };
  return map[ext] || 'plaintext';
}

const formatColors: Record<string, string> = {
  pdf: '#ef4444', docx: '#3b82f6', xlsx: '#22c55e', csv: '#22c55e',
  md: '#519aba', json: '#e5c07b', txt: '#abb2bf', cob: '#f97316', cbl: '#f97316',
  jcl: '#eab308', sql: '#e48e00', js: '#cbcb41', ts: '#3178c6', tsx: '#3178c6',
  html: '#e44d26', css: '#56b6c2', py: '#3572a5', java: '#f89820',
  xml: '#cc99cd', yaml: '#56b6c2', log: '#6d8086', pptx: '#f97316',
  sh: '#4ec9b0', bat: '#c678dd', png: '#a855f7', jpg: '#a855f7', gif: '#a855f7',
};

function isTextFormat(f: string): boolean {
  return ['txt','md','json','csv','cob','cbl','jcl','sql','js','ts','tsx','jsx','html','css','py','java','xml','yaml','log','sh','bat','cmd','ps1'].includes(f);
}

function isImageFormat(f: string): boolean {
  return ['png','jpg','jpeg','gif','svg','bmp','webp'].includes(f);
}

function TabIcon({ name, size = 14 }: { name: string; size?: number }) {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const color = formatColors[ext] || '#808080';
  if (['pdf','docx','txt','md'].includes(ext)) return <FileText size={size} color={color} />;
  if (['xlsx','csv'].includes(ext)) return <FileSpreadsheet size={size} color={color} />;
  if (['png','jpg','gif','pptx'].includes(ext)) return <FileImage size={size} color={color} />;
  if (['zip'].includes(ext)) return <FileArchive size={size} color={color} />;
  if (['cob','cbl','jcl','sh','bat'].includes(ext)) return <TerminalIcon size={size} color={color} />;
  return <FileCode size={size} color={color} />;
}

// ── Table styles ───────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '8px 12px', background: '#1a1a1a', color: '#bbbbbb',
  border: '1px solid #333', fontWeight: 600, fontSize: 11,
  textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: 0.3, textTransform: 'uppercase',
};
const tdStyle: React.CSSProperties = {
  padding: '5px 12px', border: '1px solid #333', color: '#d4d4d4',
  whiteSpace: 'nowrap', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis',
};

// ── Main Component ─────────────────────────────────────────────────────────

interface FileViewerProps {
  openTabs: FileEntry[];
  activeFile: FileEntry | null;
  viewingContent: string | null;
  binaryBlob: Blob | null;
  onSelectTab: (file: FileEntry) => void;
  onCloseTab: (name: string) => void;
  onDownload?: (name: string) => void;
}

export default function FileViewer({
  openTabs, activeFile, viewingContent, binaryBlob,
  onSelectTab, onCloseTab, onDownload,
}: FileViewerProps) {
  if (openTabs.length === 0) {
    return (
      <div style={{ flex: 1, background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#555', fontSize: 14 }}>
        <FileCode size={32} color="#3a3a3a" />
        <span>Open a file to start editing</span>
      </div>
    );
  }

  const format = activeFile?.format ?? '';

  return (
    <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1e1e1e' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', background: '#252526', borderBottom: '1px solid #1e1e1e', overflowX: 'auto', flexShrink: 0, height: 35 }}>
        {openTabs.map(tab => {
          const isActive = tab.name === activeFile?.name;
          return (
            <div key={tab.name} onClick={() => onSelectTab(tab)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: '100%', cursor: 'pointer',
                background: isActive ? '#1e1e1e' : '#2d2d2d', borderRight: '1px solid #252526',
                borderTop: isActive ? '1px solid #007acc' : '1px solid transparent',
                color: isActive ? '#ffffff' : '#8d8d8d', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0, userSelect: 'none' }}>
              <TabIcon name={tab.name} size={14} />
              <span style={{ fontWeight: isActive ? 500 : 400 }}>{tab.name}</span>
              <span onClick={e => { e.stopPropagation(); onCloseTab(tab.name); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 3, opacity: 0.6 }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = '#555'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'transparent'; }}>
                <X size={11} />
              </span>
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {!activeFile ? null :

          // ── Text/Code ── Monaco Editor ───────────────────────────────────
          viewingContent !== null && isTextFormat(format) ? (
            <MonacoEditor height="100%" language={getLanguage(activeFile.name)} theme="vs-dark" value={viewingContent}
              options={{ fontSize: 14, minimap: { enabled: true }, wordWrap: 'on', lineNumbers: 'on',
                renderLineHighlight: 'all', scrollBeyondLastLine: false, automaticLayout: true,
                tabSize: 4, insertSpaces: true, readOnly: true,
                fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                fontLigatures: true, cursorBlinking: 'smooth', smoothScrolling: true,
                bracketPairColorization: { enabled: true }, contextmenu: true, padding: { top: 8 } }} />

          ) :

          // ── DOCX ── Mammoth HTML ─────────────────────────────────────────
          format === 'docx' && binaryBlob ? (
            <DocxViewer blob={binaryBlob} />

          ) :

          // ── XLSX ── Spreadsheet table ────────────────────────────────────
          format === 'xlsx' && binaryBlob ? (
            <XlsxTable blob={binaryBlob} />

          ) :

          // ── CSV ── Table ─────────────────────────────────────────────────
          format === 'csv' && viewingContent !== null ? (
            <CsvTable content={viewingContent} />

          ) :

          // ── PDF ── Iframe with API URL ───────────────────────────────────
          format === 'pdf' ? (
            <iframe src={`/api/files?download=${encodeURIComponent(activeFile.name)}`}
              style={{ width: '100%', height: '100%', border: 'none', background: '#525659' }} title="PDF" />

          ) :

          // ── Images ── Native <img> ──────────────────────────────────────
          isImageFormat(format) ? (
            <div style={{ height: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
              <img src={`/api/files?download=${encodeURIComponent(activeFile.name)}`} alt={activeFile.name}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>

          ) :

          // ── PPTX ── pptx-preview ───────────────────────────────────────
          format === 'pptx' && binaryBlob ? (
            <PptxViewer blob={binaryBlob} />

          ) :

          // ── Other binary ── Download ────────────────────────────────────
          (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <TabIcon name={activeFile.name} size={48} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: '#cccccc', fontWeight: 500 }}>{activeFile.name}</div>
                <div style={{ fontSize: 11, color: '#6d8086', marginTop: 4 }}>{format.toUpperCase()} file</div>
              </div>
              {onDownload && (
                <button onClick={() => onDownload(activeFile.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0e639c', border: 'none', color: '#fff',
                    borderRadius: 4, padding: '8px 20px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Download size={14} /> Download
                </button>
              )}
            </div>
          )
        }
      </div>
    </div>
  );
}

// ── DOCX Viewer (Mammoth) ─────────────────────────────────────────────────

function DocxViewer({ blob }: { blob: Blob }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    blob.arrayBuffer().then(async buf => {
      const mammoth = await import('mammoth');
      const result = await mammoth.convertToHtml({ arrayBuffer: buf }, {
        convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
      });
      if (!cancelled) { setHtml(result.value); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [blob]);

  if (loading) return <Spinner text="Opening document..." />;

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#1e1e1e' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 48px', background: '#2a2a2a', minHeight: '100%' }}>
        <div dangerouslySetInnerHTML={{ __html: html }} style={{
          fontFamily: "'Segoe UI', Calibri, system-ui, sans-serif",
          color: '#d4d4d4', lineHeight: 1.8, fontSize: 14,
        }} />
      </div>
    </div>
  );
}

// ── XLSX Viewer ────────────────────────────────────────────────────────────

function XlsxTable({ blob }: { blob: Blob }) {
  const [sheets, setSheets] = useState<Array<{ name: string; headers: string[]; rows: string[][] }>>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    blob.arrayBuffer().then(async buf => {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buf, { type: 'array' });
      const parsed = wb.SheetNames.map(name => {
        const ws = wb.Sheets[name];
        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
        return { name, headers: (data[0]||[]).map(h => String(h)), rows: data.slice(1).map(r => r.map(c => String(c??''))) };
      });
      if (!cancelled) { setSheets(parsed); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [blob]);

  if (loading) return <Spinner text="Loading spreadsheet..." />;
  if (!sheets.length) return null;
  const sheet = sheets[active];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1e1e1e' }}>
      {sheets.length > 1 && (
        <div style={{ display: 'flex', background: '#252526', borderBottom: '1px solid #2d2d2d', flexShrink: 0, padding: '0 8px' }}>
          {sheets.map((s, i) => (
            <button key={s.name} onClick={() => setActive(i)}
              style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                borderRadius: '4px 4px 0 0', background: i === active ? '#1e1e1e' : 'transparent',
                color: i === active ? '#fff' : '#8d8d8d',
                borderTop: i === active ? '2px solid #22c55e' : '2px solid transparent' }}>
              {s.name} <span style={{ marginLeft: 4, fontSize: 10, color: '#555' }}>{s.rows.length}</span>
            </button>
          ))}
        </div>
      )}
      <Table headers={sheet.headers} rows={sheet.rows} rowCount={sheet.rows.length} colCount={sheet.headers.length} sheetCount={sheets.length} sheetName={sheets.length > 1 ? sheets[active].name : undefined} />
    </div>
  );
}

// ── CSV Viewer ─────────────────────────────────────────────────────────────

function CsvTable({ content }: { content: string }) {
  const { headers, rows } = useMemo(() => {
    const lines = content.split('\n').filter(l => l.trim());
    if (!lines.length) return { headers: [] as string[], rows: [] as string[][] };
    const p = (l: string) => l.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    return { headers: p(lines[0]), rows: lines.slice(1).map(p) };
  }, [content]);

  return <Table headers={headers} rows={rows} rowCount={rows.length} colCount={headers.length} />;
}

// ── Shared Table ───────────────────────────────────────────────────────────

function Table({ headers, rows, rowCount, colCount, sheetCount, sheetName }: {
  headers: string[]; rows: string[][];
  rowCount: number; colCount: number;
  sheetCount?: number; sheetName?: string;
}) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1e1e1e' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: "'Cascadia Code', Consolas, monospace", fontSize: 12 }}>
          <thead><tr>
            <th style={{ ...thStyle, position: 'sticky', top: 0, zIndex: 2, left: 0, minWidth: 45, width: 45, background: '#1a1a1a' }}>#</th>
            {headers.map((h, i) => <th key={i} style={{ ...thStyle, position: 'sticky', top: 0, zIndex: 1, background: '#1a1a1a' }}>{h || `Col ${i+1}`}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', transition: 'background 0.08s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(30, 144, 255, 0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}>
                <td style={{ ...tdStyle, color: '#555', fontSize: 10, textAlign: 'right', position: 'sticky', left: 0, zIndex: 1, background: ri % 2 === 0 ? '#1e1e1e' : '#222' }}>{ri+1}</td>
                {row.map((c, ci) => <td key={ci} style={tdStyle}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '5px 12px', borderTop: '1px solid #2d2d2d', flexShrink: 0, fontSize: 10, color: '#555', background: '#252526', display: 'flex', justifyContent: 'space-between' }}>
        <span>{rowCount} rows × {colCount} columns</span>
        {sheetCount && sheetCount > 1 && <span>{sheetCount} sheets{sheetName ? ` · ${sheetName}` : ''}</span>}
      </div>
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner({ text }: { text: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ width: 22, height: 22, border: '2px solid #333', borderTop: '2px solid #007acc', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 12, color: '#6d8086' }}>{text}</span>
    </div>
  );
}

// ── PPTX Viewer ────────────────────────────────────────────────────────────

function PptxViewer({ blob }: { blob: Blob }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [slideCount, setSlideCount] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    blob.arrayBuffer().then(async (buf) => {
      if (cancelled || !containerRef.current) return;
      try {
        const { init } = await import('pptx-preview');
        const previewer = init(containerRef.current, {});
        await previewer.preview(buf);
        if (!cancelled) {
          setSlideCount(previewer.slideCount);
          setLoading(false);
        }
      } catch (e) {
        console.error('PPTX preview error:', e);
        if (!cancelled) setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [blob]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1e1e1e' }}>
      {loading && <Spinner text="Loading presentation..." />}
      <div ref={containerRef} style={{
        flex: 1, overflow: 'auto', padding: '20px',
        display: loading ? 'none' : 'block',
      }} />
      {!loading && slideCount > 0 && (
        <div style={{ padding: '5px 12px', borderTop: '1px solid #2d2d2d', flexShrink: 0, fontSize: 10, color: '#555', background: '#252526' }}>
          {slideCount} slide{slideCount > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// ── Global styles ──────────────────────────────────────────────────────────

// Injected via the component's <style> tag (already in parent)
// DocViewer styles for dark mode
