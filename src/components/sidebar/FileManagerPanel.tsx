'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface FileEntry {
  name: string;
  size: number;
  format: string;
  createdAt: string;
  isDirectory: boolean;
}

// ── Format Colors & Icons ──────────────────────────────────────────────────

const formatColors: Record<string, string> = {
  pdf: '#ef4444', docx: '#3b82f6', xlsx: '#22c55e', csv: '#22c55e',
  md: '#94a3b8', json: '#eab308', txt: '#94a3b8', cob: '#f97316', cbl: '#f97316',
  jcl: '#eab308', sql: '#ec4899', js: '#eab308', ts: '#3b82f6', tsx: '#3b82f6',
  html: '#ef4444', css: '#8b5cf6', py: '#3b82f6', java: '#ef4444',
  xml: '#f97316', yaml: '#ef4444', log: '#64748b', pptx: '#f97316',
  folder: '#94a3b8', unknown: '#64748b',
};

const formatIcons: Record<string, string> = {
  pdf: '📊', docx: '📄', xlsx: '📊', csv: '📊', pptx: '📊',
  md: '📝', json: '{}', txt: '📄', cob: '📝', cbl: '📝',
  jcl: '📋', sql: '📄', js: '📜', ts: '📜', tsx: '📜',
  html: '🌐', css: '🎨', py: '🐍', java: '☕',
  xml: '📄', yaml: '⚙️', log: '📃', unknown: '📄', folder: '📁',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function isTextFormat(format: string): boolean {
  return ['txt', 'md', 'json', 'csv', 'cob', 'cbl', 'jcl', 'sql', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'py', 'java', 'xml', 'yaml', 'log'].includes(format);
}

// ── Main Component ─────────────────────────────────────────────────────────

interface FileManagerPanelProps {
  open: boolean;
}

export default function FileManagerPanel({ open }: FileManagerPanelProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [collapsed, setCollapsed] = useState(false);

  // Drag & drop
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  // Upload
  const [uploading, setUploading] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFormat, setNewFormat] = useState('txt');

  // Inline rename
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // File content viewer
  const [viewingFile, setViewingFile] = useState<{ name: string; content: string; format: string } | null>(null);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/files', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { files: FileEntry[]; count: number };
        setFiles(data.files ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchFiles();
  }, [open, fetchFiles]);

  // ── Filter & Sort ─────────────────────────────────────────────────────────

  const filtered = files
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortBy === 'size') return (a.size - b.size) * dir;
      return a.createdAt.localeCompare(b.createdAt) * dir;
    });

  const toggleSort = (col: 'name' | 'date' | 'size') => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  // ── Upload ────────────────────────────────────────────────────────────────

  const uploadFile = async (file: File) => {
    setUploading(prev => [...prev, file.name]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/files', { method: 'POST', credentials: 'include', body: formData });
      if (res.ok) {
        const data = await res.json() as { file: FileEntry };
        setFiles(prev => [data.file, ...prev.filter(f => f.name !== data.file.name)]);
        showToast(`Uploaded ${file.name}`);
      } else { showToast(`Failed to upload ${file.name}`, 'error'); }
    } catch { showToast(`Failed to upload ${file.name}`, 'error'); }
    setUploading(prev => prev.filter(n => n !== file.name));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    Array.from(selectedFiles).forEach(uploadFile);
    e.target.value = '';
  };

  // ── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(false); dragCounter.current = 0;
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) Array.from(droppedFiles).forEach(uploadFile);
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleCreateFile = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/files', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'create', name: newName.trim(), format: newFormat, content: '' }),
      });
      if (res.ok) {
        const data = await res.json() as { file: FileEntry };
        setFiles(prev => [data.file, ...prev]);
        setShowNewFile(false); setNewName('');
        showToast(`Created ${data.file.name}`);
      }
    } catch { /* ignore */ }
  };

  const handleCreateFolder = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/files', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'folder', name: newName.trim() }),
      });
      if (res.ok) { setShowNewFolder(false); setNewName(''); fetchFiles(); showToast(`Created folder ${newName.trim()}`); }
    } catch { /* ignore */ }
  };

  const handleRename = async (oldName: string) => {
    if (!renameValue.trim() || renameValue.trim() === oldName) { setRenamingFile(null); return; }
    try {
      const res = await fetch('/api/files', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'rename', name: oldName, newName: renameValue.trim() }),
      });
      if (res.ok) { setRenamingFile(null); fetchFiles(); showToast(`Renamed to ${renameValue.trim()}`); }
    } catch { /* ignore */ }
  };

  const handleCopy = async (name: string) => {
    const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
    const base = name.replace(/\.[^.]+$/, '');
    try {
      const res = await fetch('/api/files', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'copy', name, newName: `${base}_copy${ext}` }),
      });
      if (res.ok) {
        const data = await res.json() as { file: FileEntry };
        setFiles(prev => [data.file, ...prev]);
        showToast(`Duplicated as ${data.file.name}`);
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (name: string) => {
    try {
      const res = await fetch(`/api/files?name=${encodeURIComponent(name)}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setFiles(prev => prev.filter(f => f.name !== name));
        if (viewingFile?.name === name) setViewingFile(null);
        showToast(`Deleted ${name}`);
      }
    } catch { /* ignore */ }
    setDeleteConfirm(null);
  };

  const handleView = async (file: FileEntry) => {
    if (!isTextFormat(file.format)) { handleDownload(file.name); return; }
    try {
      const res = await fetch(`/api/files?name=${encodeURIComponent(file.name)}&content=true`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { name: string; content: string; format: string };
        setViewingFile(data);
      }
    } catch { /* ignore */ }
  };

  const handleDownload = async (name: string) => {
    try {
      const res = await fetch(`/api/files?download=${encodeURIComponent(name)}`, { credentials: 'include' });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Downloaded ${name}`);
      }
    } catch { /* ignore */ }
  };

  const handleCopyPath = (name: string) => {
    navigator.clipboard.writeText(`${file.path || name}`);
    showToast('Path copied to clipboard');
  };

  const openNewFile = () => { setShowNewFile(true); setShowNewFolder(false); setNewName(''); };
  const openNewFolder = () => { setShowNewFolder(true); setShowNewFile(false); setNewName(''); };

  if (!open) return null;

  return (
    <div style={{
      width: '250px', height: '100%',
      background: 'rgba(13, 17, 23, 0.98)',
      borderRight: '1px solid rgba(30, 144, 255, 0.12)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      flexShrink: 0, overflow: 'hidden', position: 'relative',
    }}
      onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
      onDragOver={handleDragOver} onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'rgba(30, 144, 255, 0.15)',
          border: '2px dashed rgba(59, 130, 246, 0.5)', borderRadius: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 8, pointerEvents: 'none',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 500 }}>Drop files to upload</span>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(30, 144, 255, 0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: '11px', fontWeight: 600, color: 'rgba(226, 232, 240, 0.7)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>Explorer</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          <IconBtn title="New File" onClick={openNewFile}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          </IconBtn>
          <IconBtn title="Upload File" onClick={() => fileInputRef.current?.click()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </IconBtn>
          <IconBtn title="New Folder" onClick={openNewFolder}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
          </IconBtn>
          <IconBtn title="Refresh" onClick={fetchFiles}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </IconBtn>
          <IconBtn title={collapsed ? 'Expand' : 'Collapse'} onClick={() => setCollapsed(c => !c)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed ? <polyline points="6 9 12 15 18 9" /> : <polyline points="6 15 12 9 18 15" />}
            </svg>
          </IconBtn>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} style={{ display: 'none' }} />

      {/* Search */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid rgba(30, 144, 255, 0.08)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(15, 23, 42, 0.8)', borderRadius: '4px',
          padding: '4px 8px', border: '1px solid rgba(100, 116, 139, 0.15)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search files..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: '11px', fontFamily: 'inherit',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, fontSize: '12px' }}>✕</button>
          )}
        </div>
      </div>

      {/* New File/Folder Dialog */}
      {(showNewFile || showNewFolder) && (
        <div style={{ padding: '6px 8px', borderBottom: '1px solid rgba(30, 144, 255, 0.08)' }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px' }}>{showNewFile ? '📄' : '📁'}</span>
            <input
              autoFocus
              value={newName} onChange={e => setNewName(e.target.value)}
              placeholder={showNewFile ? 'filename' : 'folder name'}
              onKeyDown={e => {
                if (e.key === 'Enter') showNewFile ? handleCreateFile() : handleCreateFolder();
                if (e.key === 'Escape') { setShowNewFile(false); setShowNewFolder(false); }
              }}
              style={{
                flex: 1, background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(30, 144, 255, 0.3)',
                borderRadius: '4px', padding: '3px 6px', color: '#e2e8f0', fontSize: '11px',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            {showNewFile && (
              <select value={newFormat} onChange={e => setNewFormat(e.target.value)} style={{
                background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '4px', padding: '3px 4px', color: '#e2e8f0', fontSize: '10px',
                fontFamily: 'inherit', outline: 'none',
              }}>
                <option value="txt">.txt</option>
                <option value="md">.md</option>
                <option value="json">.json</option>
                <option value="csv">.csv</option>
                <option value="cob">.cob</option>
                <option value="jcl">.jcl</option>
                <option value="sql">.sql</option>
                <option value="js">.js</option>
                <option value="ts">.ts</option>
                <option value="html">.html</option>
                <option value="css">.css</option>
                <option value="py">.py</option>
              </select>
            )}
            <button onClick={showNewFile ? handleCreateFile : handleCreateFolder} style={{
              background: 'rgba(30, 144, 255, 0.2)', border: '1px solid rgba(30, 144, 255, 0.4)',
              color: '#60a5fa', borderRadius: '4px', padding: '3px 8px', fontSize: '10px',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Create</button>
            <button onClick={() => { setShowNewFile(false); setShowNewFolder(false); }} style={{
              background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px', padding: '3px',
            }}>✕</button>
          </div>
        </div>
      )}

      {/* Uploading indicator */}
      {uploading.length > 0 && (
        <div style={{
          padding: '6px 12px', borderBottom: '1px solid rgba(30, 144, 255, 0.08)',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          {uploading.map(name => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#60a5fa' }}>
              <span className="spin" style={{ display: 'inline-block', fontSize: '10px' }}>⟳</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            </div>
          ))}
        </div>
      )}

      {/* File Content Viewer */}
      {viewingFile && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderTop: '1px solid rgba(30, 144, 255, 0.12)',
        }}>
          <div style={{
            padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(30, 144, 255, 0.08)', background: 'rgba(15, 23, 42, 0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <span style={{ fontSize: '12px' }}>{formatIcons[viewingFile.format] || '📄'}</span>
              <span style={{
                fontSize: '11px', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{viewingFile.name}</span>
              <span style={{ fontSize: '9px', color: formatColors[viewingFile.format] || '#64748b', fontWeight: 600, padding: '1px 4px', borderRadius: '3px', background: 'rgba(100, 116, 139, 0.15)' }}>{viewingFile.format.toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              <IconBtn title="Download" onClick={() => handleDownload(viewingFile.name)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </IconBtn>
              <IconBtn title="Close" onClick={() => setViewingFile(null)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </IconBtn>
            </div>
          </div>
          <pre style={{
            flex: 1, margin: 0, padding: '8px 12px',
            fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
            fontSize: '12px', lineHeight: '1.5', color: '#e2e8f0',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            overflowY: 'auto', background: 'rgba(0, 0, 0, 0.2)',
          }}>
            {viewingFile.content}
          </pre>
        </div>
      )}

      {/* File List */}
      {!viewingFile && (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {/* Group header */}
          <div style={{
            padding: '4px 12px', fontSize: '11px', fontWeight: 600,
            color: 'rgba(226, 232, 240, 0.5)',
            display: 'flex', alignItems: 'center', gap: '4px',
            cursor: 'pointer', userSelect: 'none',
          }} onClick={() => setCollapsed(c => !c)}>
            <span style={{ fontSize: '8px', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▶</span>
            Generated Files
            <span style={{ marginLeft: 'auto', opacity: 0.5 }}>{filtered.length}</span>
          </div>

          {!collapsed && (
            <>
              {/* Sort bar */}
              <div style={{
                display: 'flex', padding: '2px 12px 4px', gap: '8px',
                fontSize: '9px', color: 'rgba(226, 232, 240, 0.3)',
              }}>
                <span style={{ flex: 1, cursor: 'pointer', color: sortBy === 'name' ? 'rgba(226, 232, 240, 0.5)' : undefined }} onClick={() => toggleSort('name')}>
                  Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </span>
                <span style={{ width: '50px', textAlign: 'right', cursor: 'pointer', color: sortBy === 'size' ? 'rgba(226, 232, 240, 0.5)' : undefined }} onClick={() => toggleSort('size')}>
                  Size {sortBy === 'size' && (sortDir === 'asc' ? '↑' : '↓')}
                </span>
                <span style={{ width: '35px', textAlign: 'right', cursor: 'pointer', color: sortBy === 'date' ? 'rgba(226, 232, 240, 0.5)' : undefined }} onClick={() => toggleSort('date')}>
                  Date {sortBy === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                </span>
                <span style={{ width: '50px' }}></span>
              </div>

              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(226, 232, 240, 0.3)', fontSize: '12px' }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(226, 232, 240, 0.3)', fontSize: '12px' }}>
                  {search ? 'No matching files' : 'No files yet. Click + to create one.'}
                </div>
              ) : (
                filtered.map((file, i) => (
                  <FileRow
                    key={file.name}
                    file={file}
                    isRenaming={renamingFile === file.name}
                    renameValue={renameValue}
                    isDeleteConfirm={deleteConfirm === file.name}
                    onRenameStart={() => { setRenamingFile(file.name); setRenameValue(file.name); }}
                    onRenameChange={setRenameValue}
                    onRenameSubmit={() => handleRename(file.name)}
                    onRenameCancel={() => setRenamingFile(null)}
                    onCopy={() => handleCopy(file.name)}
                    onDeleteConfirm={() => setDeleteConfirm(file.name)}
                    onDelete={() => handleDelete(file.name)}
                    onDeleteCancel={() => setDeleteConfirm(null)}
                    onView={() => handleView(file)}
                    onDownload={() => handleDownload(file.name)}
                    onCopyPath={() => handleCopyPath(file.name)}
                  />
                ))
              )}
            </>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: '12px', left: '12px', right: '12px',
          padding: '8px 12px', borderRadius: '6px', zIndex: 200,
          background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${toast.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: toast.type === 'success' ? '#10b981' : '#ef4444',
          fontSize: '11px', fontWeight: 500,
          animation: 'slideUp 0.2s ease-out',
        }}>
          {toast.message}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 50px; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

// ── File Row ───────────────────────────────────────────────────────────────

function FileRow({
  file, isRenaming, renameValue, isDeleteConfirm,
  onRenameStart, onRenameChange, onRenameSubmit, onRenameCancel,
  onCopy, onDeleteConfirm, onDelete, onDeleteCancel,
  onView, onDownload, onCopyPath,
}: {
  file: FileEntry;
  isRenaming: boolean;
  renameValue: string;
  isDeleteConfirm: boolean;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onCopy: () => void;
  onDeleteConfirm: () => void;
  onDelete: () => void;
  onDeleteCancel: () => void;
  onView: () => void;
  onDownload: () => void;
  onCopyPath: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const color = formatColors[file.format] || formatColors.unknown;
  const icon = formatIcons[file.format] || '📄';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setShowActions(false); if (isDeleteConfirm) onDeleteCancel(); }}
      style={{
        padding: '3px 12px',
        display: 'flex', alignItems: 'center', gap: '6px',
        cursor: 'pointer',
        background: hover ? 'rgba(30, 144, 255, 0.06)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: '12px', flexShrink: 0, color, width: '16px', textAlign: 'center' }}>{icon}</span>

      {/* Filename */}
      <div style={{ flex: 1, minWidth: 0 }} onClick={onView}>
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={e => onRenameChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onRenameSubmit(); if (e.key === 'Escape') onRenameCancel(); }}
            onBlur={onRenameSubmit}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(30, 144, 255, 0.4)', borderRadius: '3px',
              padding: '1px 4px', color: '#e2e8f0', fontSize: '11px',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        ) : (
          <div style={{
            fontSize: '11px', color: hover ? '#e2e8f0' : 'rgba(226, 232, 240, 0.7)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.4',
            transition: 'color 0.1s',
          }}
            title={`${file.name}\nSize: ${formatSize(file.size)}\nDate: ${formatDate(file.createdAt)}\nPath: ${file.path || file.name}`}
          >
            {file.name}
          </div>
        )}
      </div>

      {/* Size + Date */}
      <span style={{ fontSize: '9px', color: 'rgba(226, 232, 240, 0.25)', flexShrink: 0, width: '50px', textAlign: 'right' }}>
        {formatSize(file.size)}
      </span>
      <span style={{ fontSize: '9px', color: 'rgba(226, 232, 240, 0.25)', flexShrink: 0, width: '35px', textAlign: 'right' }}>
        {formatDate(file.createdAt)}
      </span>

      {/* Action buttons */}
      <div style={{ width: '50px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: '1px' }}>
        {hover && !isRenaming && (
          isDeleteConfirm ? (
            <>
              <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{
                background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#ef4444', borderRadius: '3px', padding: '0 4px', fontSize: '9px', cursor: 'pointer', fontFamily: 'inherit',
              }}>Y</button>
              <button onClick={e => { e.stopPropagation(); onDeleteCancel(); }} style={{
                background: 'rgba(100, 116, 139, 0.2)', border: '1px solid rgba(100, 116, 139, 0.3)',
                color: '#94a3b8', borderRadius: '3px', padding: '0 4px', fontSize: '9px', cursor: 'pointer', fontFamily: 'inherit',
              }}>N</button>
            </>
          ) : showActions ? (
            <>
              <IconBtn title="Rename" onClick={e => { e.stopPropagation(); onRenameStart(); setShowActions(false); }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </IconBtn>
              <IconBtn title="Copy" onClick={e => { e.stopPropagation(); onCopy(); setShowActions(false); }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </IconBtn>
              <IconBtn title="Copy Path" onClick={e => { e.stopPropagation(); onCopyPath(); setShowActions(false); }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </IconBtn>
              <IconBtn title="Download" onClick={e => { e.stopPropagation(); onDownload(); setShowActions(false); }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </IconBtn>
              <IconBtn title="Delete" onClick={e => { e.stopPropagation(); onDeleteConfirm(); setShowActions(false); }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </IconBtn>
            </>
          ) : (
            <button onClick={e => { e.stopPropagation(); setShowActions(true); }} style={{
              background: 'none', border: 'none', color: 'rgba(226, 232, 240, 0.25)',
              cursor: 'pointer', padding: '1px', fontSize: '12px', lineHeight: 1,
            }}>⋯</button>
          )
        )}
      </div>
    </div>
  );
}

// ── Icon Button ────────────────────────────────────────────────────────────

function IconBtn({ title, onClick, children }: { title: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button
      title={title} onClick={onClick}
      style={{
        background: 'none', border: 'none', color: 'rgba(226, 232, 240, 0.4)',
        cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '3px', transition: 'all 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30, 144, 255, 0.1)'; e.currentTarget.style.color = '#60a5fa'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(226, 232, 240, 0.4)'; }}
    >
      {children}
    </button>
  );
}
