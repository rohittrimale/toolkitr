'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store';
import type { SshCredentials } from '@/store';

interface SshCredsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SshCredsDialog({ open, onClose }: SshCredsDialogProps) {
  const sshCredentials = useStore(s => s.sshCredentials);
  const setSshCredentials = useStore(s => s.setSshCredentials);

  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (open) {
      setHost(sshCredentials.host);
      setPort(String(sshCredentials.port || 22));
      setUsername(sshCredentials.username);
      setPassword(sshCredentials.password);
    }
  }, [open, sshCredentials]);

  const handleSave = () => {
    const creds: SshCredentials = {
      host: host.trim(),
      port: parseInt(port) || 22,
      username: username.trim(),
      password,
    };
    setSshCredentials(creds);
    onClose();
  };

  const hasCreds = !!(sshCredentials.host && sshCredentials.username);
  const canSave = host.trim().length > 0 && username.trim().length > 0;

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid rgba(30, 144, 255, 0.2)',
        borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '8px',
            background: hasCreds ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '14px' }}>{hasCreds ? '🟢' : '🔴'}</span>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>Mainframe SSH</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {hasCreds ? `Connected to ${sshCredentials.host}` : 'No credentials configured'}
            </div>
          </div>
          <button onClick={onClose} style={{
            marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b',
            cursor: 'pointer', fontSize: '16px', padding: '4px',
          }}>✕</button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#94a3b8', marginBottom: '4px' }}>
              Host / IP Address *
            </label>
            <input
              value={host} onChange={e => setHost(e.target.value)}
              placeholder="your.mainframe.host"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#94a3b8', marginBottom: '4px' }}>
                Port
              </label>
              <input
                value={port} onChange={e => setPort(e.target.value)}
                placeholder="22" type="number"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#94a3b8', marginBottom: '4px' }}>
                Username *
              </label>
              <input
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="your-username"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#94a3b8', marginBottom: '4px' }}>
              Password
            </label>
            <input
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(100, 116, 139, 0.3)',
            background: 'transparent', color: '#94a3b8', cursor: 'pointer',
            fontSize: '12px', fontWeight: 500, fontFamily: 'inherit',
          }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!canSave} style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: canSave ? 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' : '#1e293b',
            color: canSave ? '#fff' : '#475569', cursor: canSave ? 'pointer' : 'default',
            fontSize: '12px', fontWeight: 500, fontFamily: 'inherit',
            boxShadow: canSave ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
          }}>
            Save Credentials
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: '8px',
  border: '1px solid rgba(100, 116, 139, 0.3)',
  background: 'rgba(15, 23, 42, 0.8)', color: '#f1f5f9',
  fontSize: '12px', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box' as const,
};
