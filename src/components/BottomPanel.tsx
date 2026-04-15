'use client';

import { Terminal, FileText } from 'lucide-react';

export type BottomTab = 'terminal' | 'output';

interface BottomPanelProps {
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
  logs: string[];
  output: string;
  onClearLogs: () => void;
}

const TABS: { id: BottomTab; label: string; icon: React.ReactNode }[] = [
  { id: 'terminal', label: 'Terminal', icon: <Terminal size={12} /> },
  { id: 'output',   label: 'Output',   icon: <FileText size={12} /> },
];

export default function BottomPanel({
  activeTab, onTabChange, logs, output, onClearLogs,
}: BottomPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#1e1e1e' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', background: '#252526',
        borderBottom: '1px solid #1e1e1e', flexShrink: 0, userSelect: 'none',
      }}>
        {TABS.map(tab => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 14px',
                background: isActive ? '#1e1e1e' : 'transparent',
                color: isActive ? '#ffffff' : '#8d8d8d',
                border: 'none',
                borderTop: isActive ? '1px solid rgba(30, 144, 255, 0.5)' : '1px solid transparent',
                borderRight: '1px solid #252526',
                fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button
          onClick={onClearLogs}
          style={{
            background: 'none', border: 'none', color: '#8d8d8d',
            fontSize: 11, cursor: 'pointer', padding: '5px 10px',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = '#8d8d8d'}
        >
          Clear
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        <pre style={{
          margin: 0, fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
          fontSize: 12, lineHeight: 1.5, color: '#cccccc',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {activeTab === 'terminal' ? logs.join('\n') : output}
        </pre>
      </div>
    </div>
  );
}
