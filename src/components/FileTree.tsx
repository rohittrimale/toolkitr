'use client';

import { useState, useRef, useCallback } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import type { FileEntry } from '@/hooks/useFileSystem';
import {
  FileCode, FileText, FileSpreadsheet, FileImage, FileArchive, Terminal as TerminalIcon,
  Folder, FolderOpen, FilePlus2, FolderPlus, RefreshCw, ChevronDown, ChevronRight,
  Pencil, Trash2, Copy, Link, Download, Upload, Search, X, ChevronsUpDown,
} from 'lucide-react';

// ── Format colors ──────────────────────────────────────────────────────────

const formatColors: Record<string, string> = {
  pdf: '#ef4444', docx: '#3b82f6', xlsx: '#22c55e', csv: '#22c55e',
  md: '#519aba', json: '#e5c07b', txt: '#abb2bf', cob: '#f97316', cbl: '#f97316',
  jcl: '#eab308', sql: '#e48e00', js: '#cbcb41', ts: '#3178c6', tsx: '#3178c6',
  html: '#e44d26', css: '#56b6c2', py: '#3572a5', java: '#f89820',
  xml: '#cc99cd', yaml: '#56b6c2', log: '#6d8086', pptx: '#f97316',
  sh: '#4ec9b0', bat: '#c678dd',
};

function isTextFormat(format: string): boolean {
  return ['txt', 'md', 'json', 'csv', 'cob', 'cbl', 'jcl', 'sql', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'py', 'java', 'xml', 'yaml', 'log', 'sh', 'bat'].includes(format);
}

function FileIcon({ name, size = 14 }: { name: string; size?: number }) {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const color = formatColors[ext] || '#808080';
  if (['pdf', 'docx', 'txt', 'md'].includes(ext)) return <FileText size={size} color={color} />;
  if (['xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={size} color={color} />;
  if (['png', 'jpg', 'gif', 'pptx'].includes(ext)) return <FileImage size={size} color={color} />;
  if (['zip'].includes(ext)) return <FileArchive size={size} color={color} />;
  if (['cob', 'cbl', 'jcl', 'sh', 'bat'].includes(ext)) return <TerminalIcon size={size} color={color} />;
  return <FileCode size={size} color={color} />;
}

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

// ── Shared styles ──────────────────────────────────────────────────────────

const CTX_MENU: React.CSSProperties = {
  background: '#252526', border: '1px solid #454545', borderRadius: 5,
  padding: '4px 0', minWidth: 220, zIndex: 9999,
  boxShadow: '0 6px 20px rgba(0,0,0,0.5)', animation: 'fadeIn 0.08s ease-out',
};
const CTX_ITEM: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px',
  fontSize: 12, color: '#cccccc', cursor: 'pointer', outline: 'none', userSelect: 'none',
};
const CTX_SEP: React.CSSProperties = { height: 1, background: '#3a3a3a', margin: '3px 0' };

function CtxItem({ onSelect, children, danger, keybind }: {
  onSelect?: () => void; children: React.ReactNode; danger?: boolean; keybind?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <ContextMenu.Item onSelect={onSelect}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...CTX_ITEM, color: danger ? '#f48771' : '#cccccc', background: hov ? (danger ? '#5a1d1d' : '#094771') : 'transparent' }}
    >
      {children}
      {keybind && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#555' }}>{keybind}</span>}
    </ContextMenu.Item>
  );
}

// ── Inline Input ───────────────────────────────────────────────────────────

function InlineInput({ placeholder, onConfirm, onCancel }: {
  placeholder: string; onConfirm: (v: string) => void; onCancel: () => void;
}) {
  const [val, setVal] = useState('');
  return (
    <input autoFocus value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter' && val.trim()) onConfirm(val.trim());
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => { if (val.trim()) onConfirm(val.trim()); else onCancel(); }}
      style={{
        background: '#3c3c3c', color: '#d4d4d4', border: '1px solid #007acc',
        borderRadius: 2, padding: '2px 6px', fontSize: 12,
        width: '100%', outline: 'none', boxSizing: 'border-box',
      }}
    />
  );
}

// ── File Row ───────────────────────────────────────────────────────────────

function FileRow({
  file, isActive, depth,
  onOpen, onRename, onDelete, onCopy, onDownload, onCopyPath,
}: {
  file: FileEntry; isActive: boolean; depth: number;
  onOpen: () => void; onRename: (newName: string) => void;
  onDelete: () => void; onCopy: () => void; onDownload: () => void; onCopyPath: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const renameVal = useRef(file.name);

  const indent = depth * 14;
  const color = formatColors[file.format] || '#808080';
  const icon = file.isDirectory
    ? <Folder size={14} color="#dcb67a" />
    : <FileIcon name={file.name} size={14} />;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { setHovered(false); setShowActions(false); setDeleteConfirm(false); }}
          onClick={onOpen}
          style={{
            position: 'relative', display: 'flex', alignItems: 'center', gap: 4,
            paddingLeft: indent + 8, paddingRight: 6, height: 24,
            cursor: 'pointer', borderRadius: 3, fontSize: 13, color: '#cccccc',
            userSelect: 'none',
            background: isActive ? '#094771' : hovered ? '#2a2d2e' : 'transparent',
            transition: 'background 0.08s',
          }}
        >
          {/* Icon */}
          <span style={{ flexShrink: 0, lineHeight: 1, display: 'flex', opacity: hovered ? 1 : 0.85 }}>{icon}</span>

          {/* Name or rename input */}
          {renaming ? (
            <input
              autoFocus defaultValue={file.name}
              onClick={e => e.stopPropagation()}
              onChange={e => { renameVal.current = e.target.value; }}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') { onRename(renameVal.current || file.name); setRenaming(false); }
                if (e.key === 'Escape') setRenaming(false);
              }}
              onBlur={() => { onRename(renameVal.current || file.name); setRenaming(false); }}
              style={{
                flex: 1, background: '#3c3c3c', color: '#d4d4d4',
                border: '1px solid #007acc', borderRadius: 2,
                padding: '0 4px', fontSize: 12, outline: 'none',
              }}
            />
          ) : (
            <span style={{
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: hovered ? '#e2e8f0' : '#cccccc', fontWeight: hovered && !isActive ? 500 : 400,
            }}
              title={`${file.name}\n${formatSize(file.size)} · ${formatDate(file.createdAt)}\n${file.path || file.name}`}
            >{file.name}</span>
          )}

          {/* Hover inline actions */}
          {hovered && !renaming && (
            <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}
              onClick={e => e.stopPropagation()}
            >
              {deleteConfirm ? (
                <>
                  <button onClick={onDelete} style={{
                    background: '#5a1d1d', border: '1px solid #8b3a3a',
                    color: '#f48771', borderRadius: 3, padding: '0 4px', fontSize: 9, cursor: 'pointer', fontFamily: 'inherit',
                  }}>Y</button>
                  <button onClick={() => setDeleteConfirm(false)} style={{
                    background: '#3c3c3c', border: '1px solid #454545',
                    color: '#8d8d8d', borderRadius: 3, padding: '0 4px', fontSize: 9, cursor: 'pointer', fontFamily: 'inherit',
                  }}>N</button>
                </>
              ) : (
                <>
                  <button title="Rename (F2)" onClick={() => setRenaming(true)}
                    style={{ background: 'none', border: 'none', padding: '1px 3px', borderRadius: 3, cursor: 'pointer', color: hovered ? '#bbb' : '#8d8d8d', display: 'flex' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = '#bbb'}
                  ><Pencil size={12} /></button>
                  <button title="Delete" onClick={() => setDeleteConfirm(true)}
                    style={{ background: 'none', border: 'none', padding: '1px 3px', borderRadius: 3, cursor: 'pointer', color: '#8d8d8d', display: 'flex' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f48771'}
                    onMouseLeave={e => e.currentTarget.style.color = '#8d8d8d'}
                  ><Trash2 size={12} /></button>
                </>
              )}
            </div>
          )}
        </div>
      </ContextMenu.Trigger>

      {/* Right-click context menu */}
      <ContextMenu.Portal>
        <ContextMenu.Content style={CTX_MENU}>
          <CtxItem onSelect={onOpen}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16 }}>{icon}</span>
            {isTextFormat(file.format) ? 'Open File' : 'Download'}
          </CtxItem>
          <div style={CTX_SEP} />
          <CtxItem onSelect={onCopy}><Copy size={13} color="#89b4fa" /> Duplicate</CtxItem>
          <CtxItem onSelect={onCopyPath}><Link size={13} /> Copy Path</CtxItem>
          <CtxItem onSelect={onDownload}><Download size={13} /> Download</CtxItem>
          <div style={CTX_SEP} />
          <CtxItem onSelect={() => setRenaming(true)} keybind="F2">
            <Pencil size={13} color="#89b4fa" /> Rename
          </CtxItem>
          <div style={CTX_SEP} />
          <CtxItem onSelect={onDelete} keybind="Del" danger><Trash2 size={13} /> Delete</CtxItem>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

// ── Main FileTree Component ────────────────────────────────────────────────

interface FileTreeProps {
  files: FileEntry[];
  activeFileName: string;
  loading: boolean;
  onOpenFile: (file: FileEntry) => void;
  onCreateFile: (name: string) => void;
  onCreateFolder: (name: string) => void;
  onRenameFile: (oldName: string, newName: string) => void;
  onDeleteFile: (name: string) => void;
  onCopyFile: (name: string) => void;
  onDownloadFile: (name: string) => void;
  onCopyPath: (name: string) => void;
  onRefresh: () => void;
  onUpload: () => void;
}

export default function FileTree({
  files, activeFileName, loading,
  onOpenFile, onCreateFile, onCreateFolder,
  onRenameFile, onDeleteFile, onCopyFile, onDownloadFile, onCopyPath,
  onRefresh, onUpload,
}: FileTreeProps) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = files.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));

  // Sort: folders first, then by date
  filtered.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <div style={{
      width: '100%', height: '100%', background: '#252526',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, background: '#252526', borderBottom: '1px solid #1e1e1e',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 6px 5px 12px',
        }}>
          <span style={{
            fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
            color: '#bbbbbb', fontWeight: 600,
          }}>Explorer</span>
          <div style={{ display: 'flex', gap: 1 }}>
            {[
              { title: 'New File', icon: <FilePlus2 size={15} />, action: () => setCreatingType('file') },
              { title: 'Upload', icon: <Upload size={15} />, action: () => fileInputRef.current?.click() },
              { title: 'New Folder', icon: <FolderPlus size={15} />, action: () => setCreatingType('folder') },
              { title: 'Refresh', icon: <RefreshCw size={15} />, action: onRefresh },
              { title: 'Collapse All', icon: <ChevronsUpDown size={15} />, action: () => setCollapsed(c => !c) },
            ].map(b => (
              <button key={b.title} title={b.title} onClick={b.action}
                style={{
                  background: 'none', border: 'none', padding: '2px 5px', borderRadius: 3,
                  cursor: 'pointer', color: '#bbbbbb', display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#bbbbbb'}
              >{b.icon}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple
        onChange={e => {
          const selected = e.target.files;
          if (selected) Array.from(selected).forEach(f => {
            // Trigger upload via parent
            const formData = new FormData();
            formData.append('file', f);
            fetch('/api/files', { method: 'POST', credentials: 'include', body: formData })
              .then(r => r.ok ? onRefresh() : null);
          });
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />

      {/* Search */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid #1e1e1e' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#3c3c3c', borderRadius: 4, padding: '4px 8px',
          border: '1px solid transparent', transition: 'border-color 0.2s',
        }}>
          <Search size={12} color="#6d8086" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search files..."
            onFocus={e => e.currentTarget.parentElement!.style.borderColor = '#007acc'}
            onBlur={e => e.currentTarget.parentElement!.style.borderColor = 'transparent'}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#cccccc', fontSize: 12, fontFamily: 'inherit',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', color: '#6d8086', cursor: 'pointer', padding: 0, display: 'flex' }}
            ><X size={12} /></button>
          )}
        </div>
      </div>

      {/* Inline create */}
      {creatingType && (
        <div style={{ padding: '4px 8px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ fontSize: 10, color: '#7a7a7a', marginBottom: 2 }}>
            {creatingType === 'file' ? 'New File' : 'New Folder'}
          </div>
          <InlineInput
            placeholder={creatingType === 'file' ? 'filename.txt' : 'folder name'}
            onConfirm={name => {
              creatingType === 'file' ? onCreateFile(name) : onCreateFolder(name);
              setCreatingType(null);
            }}
            onCancel={() => setCreatingType(null)}
          />
        </div>
      )}

      {/* Section header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#bbbbbb',
          display: 'flex', alignItems: 'center', gap: 4,
          cursor: 'pointer', userSelect: 'none',
          position: 'sticky', top: 0, background: '#252526', zIndex: 5,
        }}
      >
        <span style={{
          fontSize: 8, transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s',
        }}>▶</span>
        Generated Files
        <span style={{ marginLeft: 'auto', color: '#6d8086', fontSize: 10 }}>{filtered.length}</span>
      </div>

      {/* File list */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#6d8086', fontSize: 12 }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#6d8086', fontSize: 12 }}>
              {search ? 'No matching files' : 'No files yet'}
            </div>
          ) : (
            filtered.map(file => (
              <FileRow
                key={file.name}
                file={file}
                isActive={file.name === activeFileName}
                depth={0}
                onOpen={() => onOpenFile(file)}
                onRename={newName => onRenameFile(file.name, newName)}
                onDelete={() => onDeleteFile(file.name)}
                onCopy={() => onCopyFile(file.name)}
                onDownload={() => onDownloadFile(file.name)}
                onCopyPath={() => onCopyPath(file.name)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
