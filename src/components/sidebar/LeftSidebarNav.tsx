'use client';

import { useState } from 'react';

interface LeftSidebarNavProps {
  connected?: boolean;
  onConnect?: () => void;
  onFileClick?: () => void;
  activeView?: string;
}

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick: () => void;
}

export default function LeftSidebarNav({
  connected = false,
  onConnect,
  onFileClick,
  activeView = 'terminal',
}: LeftSidebarNavProps) {
  const navItems: NavItem[] = [
    {
      id: 'terminal',
      icon: <TerminalIcon />,
      label: connected ? 'Terminal' : 'Connect',
      badge: connected ? '●' : undefined,
      onClick: () => onConnect?.(),
    },
    {
      id: 'files',
      icon: <FileIcon />,
      label: 'Files',
      onClick: () => onFileClick?.(),
    },
  ];

  return (
    <div
      style={{
        width: '44px',
        height: '100%',
        background: 'linear-gradient(180deg, rgba(30, 58, 138, 0.35) 0%, rgba(15, 23, 42, 0.95) 100%)',
        borderRight: '1px solid rgba(30, 144, 255, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui,-apple-system,sans-serif',
        position: 'relative',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '12px 6px',
          borderBottom: '1px solid rgba(30, 144, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '48px',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(30, 144, 255, 0.2)',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>T</span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav
        style={{
          flex: 1,
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          alignItems: 'center',
        }}
      >
        {navItems.map((item) => (
          <NavButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
            active={activeView === item.id}
            onClick={item.onClick}
          />
        ))}
      </nav>
    </div>
  );
}

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  active?: boolean;
  onClick: () => void;
}

function NavButton({ icon, label, badge, active = false, onClick }: NavButtonProps) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={label}
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        background: active ? 'rgba(30, 144, 255, 0.15)' : hover ? 'rgba(30, 144, 255, 0.08)' : 'transparent',
        border: active ? '1px solid rgba(30, 144, 255, 0.3)' : hover ? '1px solid rgba(30, 144, 255, 0.25)' : '1px solid transparent',
        color: active ? '#0ea5e9' : hover ? '#0ea5e9' : 'rgba(226, 232, 240, 0.6)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
        fontFamily: 'inherit',
        position: 'relative',
        padding: 0,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            fontSize: '6px',
            color: '#10b981',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function TerminalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
