'use client'
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useStore } from '@/store'
import type { Profile, ColorTheme, Macro } from '@/store'
import LeftSidebarNav from '../components/sidebar/LeftSidebarNav'
import SshCredsDialog from '../components/sidebar/SshCredsDialog'
import HistoryPanel from '../components/assistant/HistoryPanel'
import ResizableSidebar from '../components/ResizableSidebar'
import ResizableTerminal from '../components/ResizableTerminal'
import BottomPanel, { type BottomTab } from '../components/BottomPanel'
import FileTree from '../components/FileTree'
import FileViewer from '../components/FileViewer'
import { useFileSystem } from '@/hooks/useFileSystem'

const Terminal    = dynamic(() => import('@/components/terminal/Terminal'),    { ssr: false })
const AICopilot   = dynamic(() => import('@/components/assistant/AICopilot'),  { ssr: false })

// --- Log Panel ---------------------------------------------------------------
function LogPanel({ open }: { open: boolean }) {
  const logs = useStore(s => s.logs)
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView() }, [logs, open])
  return (
    <div className={`tn-log ${open ? 'open' : ''}`}>
      {logs.slice(-300).map((l, i) => <div key={i} className="tn-log-line">{l}</div>)}
      <div ref={bottomRef} />
    </div>
  )
}

// --- Session Uptime ----------------------------------------------------------
function useUptime() {
  const sessionStart = useStore(s => s.sessionStart)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!sessionStart) { setElapsed(0); return }
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - sessionStart) / 1000)), 1000)
    return () => clearInterval(id)
  }, [sessionStart])
  if (!sessionStart) return null
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// --- Status Bar (bottom) -----------------------------------------------------
function StatusBar({ showBottom, onToggleBottom }: { showBottom: boolean; onToggleBottom: () => void }) {
  const state         = useStore(s => s.state)
  const activeHost    = useStore(s => s.activeHost)
  const activePort    = useStore(s => s.activePort)
  const activeProfileId = useStore(s => s.activeProfile)
  const profiles      = useStore(s => s.profiles)
  const bytesRx       = useStore(s => s.bytesRx)
  const uptime        = useUptime()
  const isConnected   = state === 'connected'
  const isConnecting  = state === 'connecting' || state === 'negotiating'
  const profile       = profiles.find(p => p.id === activeProfileId)

  const dotClass = isConnected ? 'on' : isConnecting ? 'warn' : state === 'error' ? 'err' : 'off'
  const connClass = isConnected ? 'connected' : isConnecting ? 'connecting' : state === 'error' ? 'error' : 'disconnected'
  const connLabel = isConnected
    ? (profile?.name ?? `${activeHost}:${activePort}`)
    : isConnecting ? (state === 'negotiating' ? 'Negotiating…' : 'Connecting…')
    : state === 'error' ? 'Connection Error'
    : 'Not Connected'

  return (
    <div className="tn-statusbar">
      {/* Left */}
      <div className="tn-statusbar-left">
        <div className={`tn-sb-item tn-sb-conn ${connClass}`}>
          <span className={`tn-sb-dot ${dotClass}`} />
          <span className="tn-sb-label">{connLabel}</span>
          {isConnected && activeHost && (
            <span className="tn-sb-muted">{activeHost}:{activePort}</span>
          )}
        </div>
        {isConnected && uptime && (
          <div className="tn-sb-item">
            <span style={{color:'var(--e-success)', opacity:0.7}}>⏱</span>
            <span style={{color:'var(--e-success)'}}>{uptime}</span>
          </div>
        )}
      </div>
      {/* Center */}
      <div className="tn-statusbar-center">
        {isConnected && (
          <div className="tn-sb-item" style={{border:'none'}}>
            <span className="tn-sb-accent">ws://localhost:8080</span>
          </div>
        )}
      </div>
      {/* Right */}
      <div className="tn-statusbar-right">
        {isConnected && bytesRx > 0 && (
          <div className="tn-sb-item">
            <span className="tn-sb-muted">{bytesRx} screens received</span>
          </div>
        )}
        <div className="tn-sb-item">
          <span className="tn-sb-muted">Toolkitr Mainframe Platform</span>
        </div>
        <button
          onClick={onToggleBottom}
          style={{
            background: 'transparent', border: 'none',
            color: showBottom ? '#60a5fa' : 'rgba(255,255,255,0.5)',
            fontSize: 11, cursor: 'pointer', padding: '0 6px',
            fontFamily: 'inherit',
          }}
          title={showBottom ? 'Hide Panel' : 'Show Panel'}
        >
          {showBottom ? '▼ Panel' : '▲ Panel'}
        </button>
      </div>
    </div>
  )
}

// --- Top Toolbar -------------------------------------------------------------
function TopBar({
  onSettings, onShortcuts, onLog, onMacros, onAI, onSshCreds,
  showSettings, showShortcuts, showLog, showMacros, showAI,
  onConnect, onDisconnect,
}: {
  onSettings: () => void; onShortcuts: () => void; onLog: () => void; onMacros: () => void; onAI: () => void; onSshCreds: () => void
  showSettings: boolean; showShortcuts: boolean; showLog: boolean; showMacros: boolean; showAI: boolean
  onConnect?: () => void; onDisconnect: () => void
}) {
  const state          = useStore(s => s.state)
  const activeHost     = useStore(s => s.activeHost)
  const activePort     = useStore(s => s.activePort)
  const activeProfileId = useStore(s => s.activeProfile)
  const profiles       = useStore(s => s.profiles)
  const isConnected    = state === 'connected'
  const profile        = profiles.find(p => p.id === activeProfileId)

  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  }

  const statusClass = ({
    connected: 'dot-green', connecting: 'dot-yellow',
    negotiating: 'dot-yellow', error: 'dot-red', disconnected: 'dot-grey',
  } as Record<string,string>)[state] ?? 'dot-grey'

  return (
    <div className="tn-toolbar">
      {/* Minimalist: Brand + Status Only */}
      <div className="tn-tb-brand">
        <div className="tn-tb-logo">3270</div>
        <span className="tn-tb-appname">Terminal</span>
      </div>

      {/* Status indicator */}
      <div className="tn-tb-session" style={{marginLeft:'12px'}}>
        <span className={`tn-tb-dot ${statusClass}`} />
        {isConnected ? (
          <span className="tn-tb-profilename" style={{fontSize:'12px'}}>{profile ? profile.name : activeHost}</span>
        ) : (
          <span className="tn-tb-statelabel" style={{fontSize:'12px'}}>
            {state === 'connecting' ? 'Connecting…' : state === 'negotiating' ? 'Negotiating…' :
             state === 'error' ? 'Error' : 'Disconnected'}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Minimal Actions: Only 4 buttons */}
      <div className="tn-tb-actions" style={{gap:'0'}}>
        {isConnected && (
          <button className="tn-tb-btn" onClick={() => useStore.getState().exportScreen()} title="Export" style={{fontSize:'11px',padding:'4px 8px'}}>
            <ExportIcon />
          </button>
        )}
        <button className={`tn-tb-btn${showAI ? ' active' : ''}`} onClick={onAI} title="AI Copilot" style={{fontSize:'11px',padding:'4px 8px'}}>
          <AIChatIcon />
        </button>
        <button className="tn-tb-btn" onClick={onSshCreds} title="SSH Credentials" style={{fontSize:'11px',padding:'4px 8px'}}>
          <ServerIcon />
        </button>
        <button className={`tn-tb-btn${showSettings ? ' active' : ''}`} onClick={onSettings} title="Settings" style={{fontSize:'11px',padding:'4px 8px'}}>
          <GearIcon />
        </button>
        <button className={`tn-tb-btn tn-tb-btn-fs${isFullscreen ? ' active' : ''}`} onClick={toggleFullscreen} title="Fullscreen" style={{fontSize:'11px',padding:'4px 8px'}}>
          {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
        </button>
        <button 
          className={`tn-tb-btn${isConnected ? ' tn-tb-btn-danger' : ''}`}
          onClick={() => isConnected ? onDisconnect() : onConnect?.()} 
          title={isConnected ? "Disconnect" : "Connect"} 
          style={{
            fontSize:'11px',
            padding:'4px 8px',
            color: isConnected ? '#ef4444' : '#22c55e',
            borderColor: isConnected ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
            backgroundColor: isConnected ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)'
          }}
        >
          <PowerIcon />
        </button>
      </div>
    </div>
  )
}

function KbdIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>
}
function LogIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
}
function GearIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
function PowerIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
}
function ExportIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}
function MacroIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>
}
function ExpandIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
}
function CompressIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
}
function AIChatIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}

function ServerIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg>
}

// --- Theme bg/card maps (mirrors AICopilot THEME_BG / THEME_CARD) -----------
const AI_THEME_BG: Record<string, string> = {
  green:   '#00050a',
  amber:   '#070400',
  white:   '#080a10',
  blue:    '#000510',
  neon:    '#04030c',
  cyan:    '#000d14',
  purple:  '#0a0010',
  orange:  '#0d0500',
  matrix:  '#000500',
  dracula: '#21222c',
}
const AI_THEME_CARD: Record<string, string> = {
  green:   '#001008',
  amber:   '#0e0800',
  white:   '#10131c',
  blue:    '#00091c',
  neon:    '#080516',
  cyan:    '#001520',
  purple:  '#130020',
  orange:  '#160900',
  matrix:  '#000a00',
  dracula: '#282935',
}
const AI_THEME_PRIMARY: Record<string, string> = {
  green:   '#00ff41',
  amber:   '#ffb000',
  white:   '#d8dde8',
  blue:    '#40c0ff',
  neon:    '#ff61d2',
  cyan:    '#00e5ff',
  purple:  '#bf5fff',
  orange:  '#ff6600',
  matrix:  '#00ff00',
  dracula: '#bd93f9',
}
const AI_THEME_FG: Record<string, string> = {
  green:   '#00ff41',
  amber:   '#ffb000',
  white:   '#d8dde8',
  blue:    '#40c0ff',
  neon:    '#ff61d2',
  cyan:    '#00e5ff',
  purple:  '#bf5fff',
  orange:  '#ff6600',
  matrix:  '#00ff00',
  dracula: '#f8f8f2',
}

// --- Copilot AI Panel --------------------------------------------------------
function ArohiPanel({ open, onToggleHistory, showHistory }: { open: boolean; onToggleHistory?: () => void; showHistory?: boolean }) {
  const theme        = useStore(s => s.settings.theme)
  const [width, setWidth] = useState(460)
  const [everOpened, setEverOpened] = useState(false)
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  const bg      = AI_THEME_BG[theme]      ?? '#0b1018'
  const card    = AI_THEME_CARD[theme]    ?? '#0f1520'
  const primary = AI_THEME_PRIMARY[theme] ?? '#2563eb'
  const fg      = AI_THEME_FG[theme]      ?? '#edf1f7'
  const accent  = `${primary}26`
  const border  = `${primary}40`

  useEffect(() => { if (open) setEverOpened(true) }, [open])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const dx = startX.current - e.clientX
      setWidth(Math.max(300, Math.min(900, startW.current + dx)))
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // Inject all AI CSS tokens directly onto the wrapper so every child
  // (including Radix portals that escape the DOM tree) inherits them.
  const cssVars = {
    '--ai-bg':         bg,
    '--ai-card':       card,
    '--ai-popover':    card,
    '--ai-fg':         fg,
    '--ai-card-fg':    fg,
    '--ai-muted':      card,
    '--ai-muted-fg':   `${fg}99`,
    '--ai-secondary':  card,
    '--ai-secondary-fg': fg,
    '--ai-primary':    primary,
    '--ai-ring':       primary,
    '--ai-accent-fg':  primary,
    '--ai-accent':     accent,
    '--ai-border':     border,
    '--ai-input':      border,
  } as React.CSSProperties

  return (
    <div
      className={`tn-arohi-panel${open ? ' open' : ''}`}
      style={{ width: open ? width : 0, background: bg, ...cssVars }}
    >
      <div
        className="tn-arohi-resize"
        style={{ background: `${primary}22` }}
        onMouseDown={e => {
          dragging.current = true
          startX.current = e.clientX
          startW.current = width
          e.preventDefault()
        }}
      />
      <div className="tn-arohi-inner" style={{ background: bg, borderLeft: `2px solid ${primary}55` }}>
        {everOpened && <AICopilot onToggleHistory={onToggleHistory} showHistory={showHistory} />}
      </div>
    </div>
  )
}

// --- Connection Dialog -------------------------------------------------------
const TERM_TYPES = [
  'IBM-3278-2-E','IBM-3278-2','IBM-3279-2-E','IBM-3279-2',
  'IBM-3278-3-E','IBM-3278-4-E','IBM-3278-5-E',
]

function ConnDialog() {
  const state         = useStore(s => s.state)
  const connect       = useStore(s => s.connect)
  const profiles      = useStore(s => s.profiles)
  const saveProfile   = useStore(s => s.saveProfile)
  const deleteProfile = useStore(s => s.deleteProfile)

  const [host,     setHost]     = useState('')
  const [port,     setPort]     = useState('2355')
  const [profName, setProfName] = useState('')
  const [desc,     setDesc]     = useState('')
  const [termType, setTermType] = useState('IBM-3278-2-E')
  const [saveAs,   setSaveAs]   = useState(false)
  const [confirmDel, setConfirmDel] = useState<string|null>(null)

  const isConnecting = state === 'connecting' || state === 'negotiating'

  const pickProfile = (p: Profile) => {
    setHost(p.host); setPort(String(p.port))
    setProfName(p.name); setDesc(p.description)
    if (TERM_TYPES.includes(p.termType)) setTermType(p.termType)
    setSaveAs(false)
  }

  const doConnect = () => {
    let pid = ''
    if (saveAs && profName.trim()) {
      pid = saveProfile({ name: profName.trim(), host, port: parseInt(port,10)||2355, description: desc.trim(), termType })
    }
    sessionStorage.setItem('tn3270_host', host)
    sessionStorage.setItem('tn3270_port', port)
    connect(host, parseInt(port,10)||2355, false, pid)
  }

  const fmtAge = (ts?: number) => {
    if (!ts) return ''
    const diff = Math.floor((Date.now() - ts) / 60000)
    if (diff < 1) return 'Just now'
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.floor(diff/60)}h ago`
    return new Date(ts).toLocaleDateString()
  }

  return (
    <div className="tn-conn-overlay">
      <div className="tn-conn-card-v2">
        <div className="tn-conn-header">
          <div className="tn-conn-logo">3270</div>
          <div>
            <div className="tn-conn-title">Mainframe Terminal</div>
            <div className="tn-conn-subtitle">Toolkitr · Enterprise Edition</div>
          </div>
          <div className="tn-conn-header-badges">
            <span className="tn-conn-badge accent">Toolkitr</span>
            <span className="tn-conn-badge">WebSocket</span>
            <span className="tn-conn-badge">v2.0</span>
          </div>
        </div>
        <div className="tn-conn-body">

          {/* Profiles pane */}
          <div className="tn-profile-pane">
            <div className="tn-pane-label-row">
              <div className="tn-pane-label">SAVED PROFILES</div>
              {profiles.length > 0 && <span className="tn-pane-count">{profiles.length}</span>}
            </div>
            <div className="tn-profile-list">
              {profiles.length === 0 && (
                <div className="tn-profile-empty">
                  <div className="tn-profile-empty-icon">▣</div>
                  <div className="tn-profile-empty-text">No saved profiles yet.<br/>Save one after connecting.</div>
                </div>
              )}
              {[...profiles].sort((a,b)=>(b.lastUsed??b.createdAt)-(a.lastUsed??a.createdAt)).map(p => (
                <div key={p.id} className="tn-profile-item" onClick={() => pickProfile(p)} style={{display:'flex',gap:'9px',alignItems:'flex-start'}}>
                  <div className="tn-profile-icon">{p.name.charAt(0).toUpperCase()}</div>
                  <div style={{flex:1,minWidth:0}}>
                  <div className="tn-profile-item-top">
                    <span className="tn-profile-item-name">{p.name}</span>
                    {confirmDel === p.id ? (
                      <span className="tn-profile-del-confirm" onClick={e=>e.stopPropagation()}>
                        <span>Sure?</span>
                        <button onClick={()=>{deleteProfile(p.id);setConfirmDel(null)}}>Yes</button>
                        <button onClick={()=>setConfirmDel(null)}>No</button>
                      </span>
                    ) : (
                      <button className="tn-profile-del" onClick={e=>{e.stopPropagation();setConfirmDel(p.id)}} title="Delete">✕</button>
                    )}
                  </div>
                  <div className="tn-profile-item-host">{p.host}:{p.port}</div>
                  {p.description && <div className="tn-profile-item-desc">{p.description}</div>}
                  <div className="tn-profile-item-meta">
                    <span>{p.termType}</span>
                    {p.lastUsed && <span>{fmtAge(p.lastUsed)}</span>}
                  </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form pane */}
          <div className="tn-form-pane">
            <div className="tn-pane-label">CONNECTION DETAILS</div>
            <div className="tn-row">
              <div className="tn-field-group" style={{flex:3}}>
                <label className="tn-label">Host / IP Address</label>
                <input className="tn-input" value={host} onChange={e=>setHost(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&!isConnecting&&doConnect()} placeholder="hostname or IP" autoFocus />
              </div>
              <div className="tn-field-group" style={{flex:1}}>
                <label className="tn-label">Port</label>
                <input className="tn-input" value={port} onChange={e=>setPort(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&!isConnecting&&doConnect()} placeholder="23" />
              </div>
            </div>
            <div className="tn-field-group">
              <label className="tn-label">Terminal Type</label>
              <select className="tn-input tn-select" value={termType} onChange={e=>setTermType(e.target.value)}>
                {TERM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="tn-conn-divider" style={{margin:'6px 0'}} />
            <label className="tn-label tn-label-row">
              <input type="checkbox" className="tn-checkbox" checked={saveAs} onChange={e=>setSaveAs(e.target.checked)} />
              Save as Profile
            </label>
            {saveAs && (
              <>
                <div className="tn-field-group">
                  <label className="tn-label">Profile Name *</label>
                  <input className="tn-input" value={profName} onChange={e=>setProfName(e.target.value)} placeholder="e.g. PROD Mainframe" />
                </div>
                <div className="tn-field-group">
                  <label className="tn-label">Description</label>
                  <input className="tn-input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Optional notes" />
                </div>
              </>
            )}
            {state === 'error' && (
              <div className="tn-error-msg"><span>⚠</span> Connection failed — check host / port</div>
            )}
            <button className="tn-btn-connect" onClick={doConnect} disabled={isConnecting}>
              {isConnecting ? 'Connecting…' : 'Connect →'}
            </button>
            <div className="tn-conn-footer">{termType} · TN3270 · ws://localhost:8080</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Settings Panel ----------------------------------------------------------
type CT = 'green'|'amber'|'white'|'blue'|'neon'|'cyan'|'purple'|'orange'|'matrix'|'dracula'
const THEMES: {id:CT;label:string;fg:string;bg:string}[] = [
  {id:'green',   label:'Green',   fg:'#00ff41', bg:'#00050a'},
  {id:'amber',   label:'Amber',   fg:'#ffb000', bg:'#070400'},
  {id:'white',   label:'White',   fg:'#e8e8e8', bg:'#0a0a0f'},
  {id:'blue',    label:'Blue',    fg:'#40c0ff', bg:'#00030a'},
  {id:'neon',    label:'Neon',    fg:'#ff61d2', bg:'#04030c'},
  {id:'cyan',    label:'Cyan',    fg:'#00e5ff', bg:'#000d14'},
  {id:'purple',  label:'Purple',  fg:'#bf5fff', bg:'#0a0010'},
  {id:'orange',  label:'Orange',  fg:'#ff6600', bg:'#0d0500'},
  {id:'matrix',  label:'Matrix',  fg:'#00ff00', bg:'#000500'},
  {id:'dracula', label:'Dracula', fg:'#f8f8f2', bg:'#21222c'},
]

function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings       = useStore(s => s.settings)
  const updateSettings = useStore(s => s.updateSettings)
  const autoReconnect  = useStore(s => s.autoReconnect)
  const setAR          = useStore(s => s.setAutoReconnect)
  return (
    <div className={`tn-settings-panel${open ? ' open' : ''}`}>
      <div className="tn-settings-header">
        <div className="tn-settings-header-left">
          <div className="tn-settings-header-icon"><GearIcon /></div>
          <span className="tn-settings-title">Settings</span>
        </div>
        <button className="tn-settings-close" onClick={onClose}>✕</button>
      </div>
      <div className="tn-settings-section">
        <div className="tn-settings-section-title">APPEARANCE</div>
        <div className="tn-settings-row">
          <span className="tn-settings-label">Font Size</span>
          <div className="tn-font-slider-row">
            <button className="tn-font-adj" onClick={()=>updateSettings({fontSize:Math.max(10,settings.fontSize-1)})}>−</button>
            <input
              type="range" min={10} max={24} step={1}
              value={settings.fontSize}
              onChange={e=>updateSettings({fontSize:Number(e.target.value)})}
              className="tn-font-slider"
            />
            <button className="tn-font-adj" onClick={()=>updateSettings({fontSize:Math.min(24,settings.fontSize+1)})}>+</button>
            <span className="tn-font-val">{settings.fontSize}px</span>
          </div>
        </div>
        <div className="tn-settings-row"><span className="tn-settings-label">Color Theme</span></div>
        <div className="tn-theme-tiles">
          {THEMES.map(t => (
            <button key={t.id}
              className={`tn-theme-tile${settings.theme===t.id?' active':''}`}
              style={{'--tile-fg':t.fg,'--tile-bg':t.bg} as React.CSSProperties}
              onClick={()=>updateSettings({theme:t.id as CT})} title={t.label}>
              <span className="tn-theme-tile-preview">A_</span>
              <span className="tn-theme-tile-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="tn-settings-section">
        <div className="tn-settings-section-title">INTERFACE</div>
        <TR label="PF Function Key Bar"   desc="Show F1–F12 key buttons"           checked={settings.showPfBar}     onChange={v=>updateSettings({showPfBar:v})} />
        <TR label="F13–F24 Shift Row"     desc="Show second row for Shift+F1–F12"  checked={settings.showShiftRow}  onChange={v=>updateSettings({showShiftRow:v})} />
        <TR label="CRT Scanlines"         desc="Subtle scanline overlay on screen"  checked={settings.showScanlines} onChange={v=>updateSettings({showScanlines:v})} />
      </div>
      <div className="tn-settings-section">
        <div className="tn-settings-section-title">SESSION</div>
        <TR label="Auto-reconnect" desc="Reconnect automatically if disconnected" checked={autoReconnect} onChange={setAR} />
      </div>
      <div className="tn-settings-footer">Settings are saved to browser storage automatically.</div>
    </div>
  )
}
function TR({label,desc,checked,onChange}:{label:string;desc:string;checked:boolean;onChange:(v:boolean)=>void}) {
  return (
    <div className="tn-settings-row tn-toggle-row" onClick={()=>onChange(!checked)}>
      <div className="tn-toggle-info">
        <span className="tn-settings-label">{label}</span>
        <span className="tn-settings-desc">{desc}</span>
      </div>
      <div className={`tn-toggle${checked?' on':''}`}><div className="tn-toggle-thumb" /></div>
    </div>
  )
}

// --- Keyboard Shortcuts Modal ------------------------------------------------
const SHORTCUTS = [
  ['Enter',          'Send AID / ENTER key'],
  ['Escape',         'Clear screen (CLEAR) / exit history / close find'],
  ['F1 – F12',       'PF1 – PF12'],
  ['Shift+F1–F12',   'PF13 – PF24'],
  ['Alt+1',          'PA1'],
  ['Alt+2',          'PA2'],
  ['Alt+3',          'PA3'],
  ['Tab',            'Tab to next unprotected field'],
  ['Shift+Tab',      'Tab to previous field'],
  ['← → ↑ ↓',       'Move cursor one position'],
  ['Home',           'Start of current line'],
  ['End',            'End of current line'],
  ['Backspace',      'Move cursor left + delete character'],
  ['Delete',         'Delete character at cursor position'],
  ['Ctrl+F',         'Find on screen'],
  ['Alt+←',          'View previous screen in history'],
  ['Alt+→',          'View next screen in history'],
  ['Ctrl+C',         'Copy screen text to clipboard (no selection)'],
  ['Click',          'Position cursor to clicked cell'],
]

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="tn-modal-backdrop" onClick={onClose}>
      <div className="tn-modal" onClick={e=>e.stopPropagation()}>
        <div className="tn-modal-header">
          <div className="tn-modal-header-left">
            <div className="tn-modal-header-icon"><KbdIcon /></div>
            <span className="tn-modal-title">Keyboard Shortcuts</span>
          </div>
          <button className="tn-settings-close" onClick={onClose}>✕</button>
        </div>
        <div className="tn-modal-body">
          <table className="tn-shortcuts-table">
            <thead><tr><th>Key</th><th>Action</th></tr></thead>
            <tbody>
              {SHORTCUTS.map(([k,a]) => (
                <tr key={k}><td><kbd className="tn-kbd">{k}</kbd></td><td>{a}</td></tr>
              ))}
            </tbody>
          </table>
          <p style={{marginTop:16,fontSize:11,color:'#4a5568'}}>
            Use the on-screen PF bar for additional function keys.
          </p>
        </div>
      </div>
    </div>
  )
}

// --- Macro Panel -------------------------------------------------------------
function MacroPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const macros         = useStore(s => s.macros)
  const recording      = useStore(s => s.recording)
  const recordingName  = useStore(s => s.recordingName)
  const startRecording = useStore(s => s.startRecording)
  const stopRecording  = useStore(s => s.stopRecording)
  const cancelRecording = useStore(s => s.cancelRecording)
  const deleteMacro    = useStore(s => s.deleteMacro)
  const runMacro       = useStore(s => s.runMacro)
  const [newName, setNewName] = useState('')

  return (
    <div className={`tn-settings-panel${open ? ' open' : ''}`}>
      <div className="tn-settings-header">
        <div className="tn-settings-header-left">
          <div className="tn-settings-header-icon"><MacroIcon /></div>
          <span className="tn-settings-title">Macros</span>
        </div>
        <button className="tn-settings-close" onClick={onClose}>✕</button>
      </div>
      <div className="tn-settings-section">
        <div className="tn-settings-section-title">RECORD NEW MACRO</div>
        {recording ? (
          <div className="tn-macro-recording">
            <span className="tn-rec-indicator">⏺ Recording: <b>{recordingName}</b></span>
            <div className="tn-macro-rec-btns">
              <button className="tn-macro-btn tn-macro-stop" onClick={stopRecording}>Stop &amp; Save</button>
              <button className="tn-macro-btn tn-macro-cancel" onClick={cancelRecording}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="tn-macro-rec-row">
            <input
              className="tn-input"
              placeholder="Macro name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { startRecording(newName.trim()); setNewName('') } }}
            />
            <button className="tn-macro-btn tn-macro-start"
              onClick={() => { if (newName.trim()) { startRecording(newName.trim()); setNewName('') } }}
              disabled={!newName.trim()}>
              ⏺ Record
            </button>
          </div>
        )}
      </div>
      <div className="tn-settings-section">
        <div className="tn-settings-section-title">SAVED MACROS ({macros.length})</div>
        {macros.length === 0 && <div className="tn-profile-empty">No macros saved yet. Record one above.</div>}
        {macros.map((m: Macro) => (
          <div key={m.id} className="tn-macro-item">
            <div className="tn-macro-item-info">
              <span className="tn-macro-item-name">{m.name}</span>
              <span className="tn-macro-item-steps">{m.steps.length} steps</span>
            </div>
            <div className="tn-macro-item-btns">
              <button className="tn-macro-btn tn-macro-run" onClick={() => runMacro(m.id)} title="Run macro">▶ Run</button>
              <button className="tn-macro-btn tn-macro-del" onClick={() => deleteMacro(m.id)} title="Delete macro">✕</button>
            </div>
          </div>
        ))}
      </div>
      <div className="tn-settings-footer">Macros are saved to browser storage. Click anywhere on screen to record keystrokes.</div>
    </div>
  )
}

// --- Main Page ---------------------------------------------------------------
export default function Page() {
  const state      = useStore(s => s.state)
  const disconnect = useStore(s => s.disconnect)
  const connect    = useStore(s => s.connect)
  const theme      = useStore(s => s.settings.theme)

  const [showForm,      setShowForm]      = useState(false)
  const [showSettings,  setShowSettings]  = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showLog,       setShowLog]       = useState(false)
  const [showMacros,    setShowMacros]    = useState(false)
  const [showAI,        setShowAI]        = useState(false)
  const [showHistory,   setShowHistory]   = useState(false)
  const [showSshCreds,  setShowSshCreds]  = useState(false)
  const [showFileManager, setShowFileManager] = useState(false)
  const [showBottom, setShowBottom] = useState(false)
  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal')
  const logs = useStore(s => s.logs)

  // File system
  const {
    files, loading: filesLoading, activeFile, openTabs, viewingContent, binaryBlob,
    fetchFiles, openFile, closeTab, selectTab,
    createFile, createFolder, renameFile, copyFile, deleteFile,
    downloadFile,
  } = useFileSystem();

  const [mounted,       setMounted]       = useState(false)

  // Prevent hydration mismatch — Zustand store reads localStorage synchronously
  // on the client but the server has no localStorage, so initial states differ.
  // Rendering null until mounted ensures client take-over with no SSR mismatch.
  useEffect(() => setMounted(true), [])

  // Auto-reconnect from sessionStorage on page load
  useEffect(() => {
    const h = sessionStorage.getItem('tn3270_host')
    const p = sessionStorage.getItem('tn3270_port')
    if (h && p) connect(h, parseInt(p,10)||2355, false, '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (state === 'connected')   setShowForm(false)
  }, [state])

  const handleDisconnect = () => {
    sessionStorage.removeItem('tn3270_host')
    sessionStorage.removeItem('tn3270_port')
    disconnect()
  }

  if (!mounted) return null

  return (
    <div className="tn-app" data-theme={theme}>
      <TopBar
        onSettings={()  => { setShowSettings(p=>!p); setShowShortcuts(false); setShowMacros(false) }}
        onShortcuts={()  => { setShowShortcuts(p=>!p); setShowSettings(false); setShowMacros(false) }}
        onLog={()        => setShowLog(p=>!p)}
        onMacros={()     => { setShowMacros(p=>!p); setShowSettings(false); setShowShortcuts(false) }}
        onAI={()         => setShowAI(p=>!p)}
        onSshCreds={()   => setShowSshCreds(true)}
        showSettings={showSettings}
        showShortcuts={showShortcuts}
        showLog={showLog}
        showMacros={showMacros}
        showAI={showAI}
        onConnect={() => setShowForm(true)}
        onDisconnect={handleDisconnect}
      />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {showHistory ? (
          <HistoryPanel onClose={() => setShowHistory(false)} />
        ) : (
          <LeftSidebarNav
            connected={state === 'connected'}
            onConnect={() => setShowForm(true)}
            activeView={showFileManager ? 'files' : 'terminal'}
            onFileClick={() => { setShowFileManager(p => !p); if (!showFileManager) fetchFiles(); }}
          />
        )}

        {/* File Manager sidebar (resizable) */}
        {showFileManager && (
          <ResizableSidebar initialWidth={250} minWidth={180} maxWidth={500}>
            <FileTree
              files={files}
              activeFileName={activeFile?.name ?? ''}
              loading={filesLoading}
              onOpenFile={openFile}
              onCreateFile={createFile}
              onCreateFolder={createFolder}
              onRenameFile={renameFile}
              onDeleteFile={deleteFile}
              onCopyFile={copyFile}
              onDownloadFile={downloadFile}
              onCopyPath={name => { navigator.clipboard.writeText(`/path/to/${name}`); }}
              onRefresh={fetchFiles}
              onUpload={() => {}}
            />
          </ResizableSidebar>
        )}

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            {/* When file manager is open, show FileViewer. Otherwise show Terminal. */}
            {showFileManager ? (
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <FileViewer
                  openTabs={openTabs}
                  activeFile={activeFile}
                  viewingContent={viewingContent}
                  binaryBlob={binaryBlob}
                  onSelectTab={selectTab}
                  onCloseTab={closeTab}
                  onDownload={downloadFile}
                />
              </div>
            ) : (
              <div className="tn-content" style={{ flex: 1 }}>
                <Terminal />
              </div>
            )}
            <ArohiPanel open={showAI} onToggleHistory={() => setShowHistory(p => !p)} showHistory={showHistory} />
          </div>
          {showBottom && (
            <ResizableTerminal initialHeight={260} minHeight={120} maxHeight={600}>
              <BottomPanel
                activeTab={bottomTab}
                onTabChange={setBottomTab}
                logs={logs}
                output={""}
                onClearLogs={() => {}}
              />
            </ResizableTerminal>
          )}
        </div>
      </div>
      {showForm && <ConnDialog />}
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      <MacroPanel    open={showMacros}   onClose={() => setShowMacros(false)} />
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      <SshCredsDialog open={showSshCreds} onClose={() => setShowSshCreds(false)} />
      <LogPanel open={showLog} />
      <StatusBar showBottom={showBottom} onToggleBottom={() => setShowBottom(p => !p)} />
    </div>
  )
}
