'use client';

import { useState, useCallback, useRef } from 'react';

export interface FileEntry {
  name: string;
  size: number;
  format: string;
  createdAt: string;
  isDirectory: boolean;
  content?: string;
}

export function useFileSystem() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFile, setActiveFile] = useState<FileEntry | null>(null);
  const [openTabs, setOpenTabs] = useState<FileEntry[]>([]);
  const [viewingContent, setViewingContent] = useState<string | null>(null);
  const [binaryBlob, setBinaryBlob] = useState<Blob | null>(null);

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

  const openFile = useCallback(async (file: FileEntry) => {
    setActiveFile(file);
    setOpenTabs(prev => {
      if (prev.find(t => t.name === file.name)) return prev;
      return [...prev, file];
    });

    setViewingContent(null);
    setBinaryBlob(null);

    const textFormats = ['txt', 'md', 'json', 'csv', 'cob', 'cbl', 'jcl', 'sql', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'py', 'java', 'xml', 'yaml', 'log', 'sh', 'bat', 'cmd', 'ps1'];
    const blobFormats = ['xlsx', 'docx', 'pptx']; // Needs blob for client-side parsing

    if (textFormats.includes(file.format)) {
      // Text file — load as text content
      try {
        const res = await fetch(`/api/files?name=${encodeURIComponent(file.name)}&content=true`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json() as { content: string };
          setViewingContent(data.content);
        }
      } catch { /* ignore */ }
    } else if (blobFormats.includes(file.format)) {
      // Binary that needs client-side parsing — load as blob
      try {
        const res = await fetch(`/api/files?download=${encodeURIComponent(file.name)}`, { credentials: 'include' });
        if (res.ok) {
          const blob = await res.blob();
          setBinaryBlob(blob);
        }
      } catch { /* ignore */ }
    }
    // DOCX/PDF/PPTX/images — DocViewer loads directly from API URL, no blob needed
  }, []);

  const closeTab = useCallback((name: string) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t.name !== name);
      if (activeFile?.name === name) {
        setActiveFile(next[next.length - 1] ?? null);
        setViewingContent(null);
        setBinaryBlob(null);
      }
      return next;
    });
  }, [activeFile]);

  const selectTab = useCallback((file: FileEntry) => {
    openFile(file);
  }, [openFile]);

  const createFile = useCallback(async (name: string) => {
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'create', name, format: name.split('.').pop() || 'txt', content: '' }),
      });
      if (res.ok) {
        const data = await res.json() as { file: FileEntry };
        setFiles(prev => [data.file, ...prev]);
        openFile(data.file);
      }
    } catch { /* ignore */ }
  }, [openFile]);

  const createFolder = useCallback(async (name: string) => {
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'folder', name }),
      });
      if (res.ok) fetchFiles();
    } catch { /* ignore */ }
  }, [fetchFiles]);

  const renameFile = useCallback(async (oldName: string, newName: string) => {
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'rename', name: oldName, newName }),
      });
      if (res.ok) fetchFiles();
    } catch { /* ignore */ }
  }, [fetchFiles]);

  const copyFile = useCallback(async (name: string) => {
    const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
    const base = name.replace(/\.[^.]+$/, '');
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'copy', name, newName: `${base}_copy${ext}` }),
      });
      if (res.ok) {
        const data = await res.json() as { file: FileEntry };
        setFiles(prev => [data.file, ...prev]);
      }
    } catch { /* ignore */ }
  }, []);

  const deleteFile = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/files?name=${encodeURIComponent(name)}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setFiles(prev => prev.filter(f => f.name !== name));
        closeTab(name);
      }
    } catch { /* ignore */ }
  }, [closeTab]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/files', { method: 'POST', credentials: 'include', body: formData });
      if (res.ok) {
        const data = await res.json() as { file: FileEntry };
        setFiles(prev => [data.file, ...prev.filter(f => f.name !== data.file.name)]);
      }
    } catch { /* ignore */ }
  }, []);

  const downloadFile = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/files?download=${encodeURIComponent(name)}`, { credentials: 'include' });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch { /* ignore */ }
  }, []);

  return {
    files, loading, activeFile, openTabs, viewingContent, binaryBlob,
    fetchFiles, openFile, closeTab, selectTab,
    createFile, createFolder, renameFile, copyFile, deleteFile,
    uploadFile, downloadFile,
  };
}
