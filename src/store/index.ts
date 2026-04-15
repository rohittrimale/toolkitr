import { create } from 'zustand'
import { TN3270Client, Cell, Screen, ConnState } from '@/lib/terminal/tn3270'
import { a2e, AID_ENTER, AID_CLEAR, AID_PA1, AID_PA2, AID_PA3, AID_PF } from '@/lib/terminal/protocol'

export type { Screen, Cell, ConnState }

// ─── Profile ─────────────────────────────────────────────────────────────────
export interface Profile {
  id: string
  name: string
  host: string
  port: number
  description: string
  termType: string
  createdAt: number
  lastUsed?: number
}

// ─── SSH Credentials ──────────────────────────────────────────────────────────
export interface SshCredentials {
  host: string
  port: number
  username: string
  password: string
}
export type MacroStep =
  | { type: 'key';  aid: number }
  | { type: 'type'; text: string }
  | { type: 'wait'; ms: number }

export interface Macro {
  id:        string
  name:      string
  steps:     MacroStep[]
  createdAt: number
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export type ColorTheme = 'green' | 'amber' | 'white' | 'blue' | 'neon' | 'cyan' | 'purple' | 'orange' | 'matrix' | 'dracula'
export interface AppSettings {
  fontSize:      number
  theme:         ColorTheme
  showPfBar:     boolean
  showScanlines: boolean
  showShiftRow:  boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  fontSize:      14,
  theme:         'green',
  showPfBar:     true,
  showScanlines: true,
  showShiftRow:  false,
}

const MAX_HISTORY = 50

function loadProfiles(): Profile[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem('tn3270_profiles') ?? '[]') } catch { return [] }
}
function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('tn3270_settings') ?? '{}') } } catch { return DEFAULT_SETTINGS }
}
function loadMacros(): Macro[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem('tn3270_macros') ?? '[]') } catch { return [] }
}
function loadSshCredentials(): SshCredentials {
  if (typeof window === 'undefined') return { host: '', port: 22, username: '', password: '' }
  try {
    const saved = JSON.parse(localStorage.getItem('tn3270_ssh') ?? '{}')
    return {
      host: saved.host || process.env.NEXT_PUBLIC_SSH_HOST || '',
      port: saved.port || parseInt(process.env.NEXT_PUBLIC_SSH_PORT || '22'),
      username: saved.username || process.env.NEXT_PUBLIC_SSH_USERNAME || '',
      password: saved.password || process.env.NEXT_PUBLIC_SSH_PASSWORD || '',
    }
  } catch {
    return { host: '', port: 22, username: '', password: '' }
  }
}
function saveSshCredentials(creds: SshCredentials): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('tn3270_ssh', JSON.stringify(creds))
}

// ─── Store Interface ──────────────────────────────────────────────────────────
interface Store {
  // connection
  screen:        Screen | null
  state:         ConnState
  logs:          string[]
  autoReconnect: boolean
  activeHost:    string
  activePort:    number
  activeProfile: string
  sessionStart:  number | null
  bytesRx:       number

  // screen history
  history:       Screen[]
  historyIdx:    number          // -1 = live

  // find
  findQuery:     string
  findMatches:   number[]        // cell indices that match
  findCurrent:   number          // index into findMatches

  // macros
  macros:        Macro[]
  recording:     boolean
  recordingSteps: MacroStep[]
  recordingName:  string

  // profiles + settings
  profiles:  Profile[]
  settings:  AppSettings

  // ssh credentials for AI tools
  sshCredentials: SshCredentials
  setSshCredentials: (creds: SshCredentials) => void

  // actions
  connect:          (host: string, port: number, autoReconnect?: boolean, profileId?: string) => void
  disconnect:       () => void
  sendAid:          (aid: number) => void
  typeChar:         (ch: string) => void
  deleteChar:       () => void
  moveCursor:       (dir: 'left'|'right'|'up'|'down'|'home'|'end') => void
  setCursorPos:     (pos: number) => void
  tabField:         (reverse: boolean) => void
  setAutoReconnect: (v: boolean) => void

  // history
  historyBack:      () => void
  historyForward:   () => void
  historyExit:      () => void
  getViewScreen:    () => Screen | null

  // find
  setFind:          (q: string) => void
  findNext:         (reverse?: boolean) => void
  clearFind:        () => void

  // macros
  startRecording:   (name: string) => void
  stopRecording:    () => void
  cancelRecording:  () => void
  saveMacro:        (m: Omit<Macro, 'id' | 'createdAt'>) => string
  deleteMacro:      (id: string) => void
  runMacro:         (id: string) => void

  // profiles / settings
  saveProfile:    (p: Omit<Profile, 'id' | 'createdAt'>) => string
  deleteProfile:  (id: string) => void
  updateSettings: (patch: Partial<AppSettings>) => void

  // export
  exportScreen:   () => void
  exportLog:      () => void
}

let _client: TN3270Client | null = null
let _timer:  ReturnType<typeof setTimeout> | null = null
let _hostRef = ''; let _portRef = 0

function doFind(screen: Screen | null, q: string): number[] {
  if (!screen || !q) return []
  const lower = q.toLowerCase()
  const matches: number[] = []
  const { cells, cols } = screen
  for (let i = 0; i < cells.length; i++) {
    // try to match starting at i
    let ok = true
    for (let j = 0; j < lower.length; j++) {
      const ci = i + j
      if (ci >= cells.length) { ok = false; break }
      if ((cells[ci].char || ' ').toLowerCase() !== lower[j]) { ok = false; break }
    }
    if (ok) matches.push(i)
  }
  return matches
}

export const useStore = create<Store>((set, get) => ({
  screen:         null,
  state:          'disconnected',
  logs:           [],
  autoReconnect:  false,
  activeHost:     '',
  activePort:     0,
  activeProfile:  '',
  sessionStart:   null,
  bytesRx:        0,
  history:        [],
  historyIdx:     -1,
  findQuery:      '',
  findMatches:    [],
  findCurrent:    0,
  macros:         loadMacros(),
  recording:      false,
  recordingSteps: [],
  recordingName:  '',
  profiles:       loadProfiles(),
  settings:       loadSettings(),
  sshCredentials: loadSshCredentials(),

  setSshCredentials: (creds: SshCredentials) => {
    saveSshCredentials(creds)
    set({ sshCredentials: creds })
  },

  connect: (host: string, port: number, autoReconnect = false, profileId = '') => {
    if (_timer) { clearTimeout(_timer); _timer = null }
    _hostRef = host; _portRef = port
    set({ autoReconnect, activeHost: host, activePort: port, activeProfile: profileId, bytesRx: 0, history: [], historyIdx: -1 })

    if (_client) { _client.disconnect(); _client = null }
    _client = new TN3270Client('IBM-3278-2-E')

    _client.onState = (s) => {
      set({ state: s })
      if (s === 'connected') {
        set({ sessionStart: Date.now() })
        const { activeProfile, profiles } = get()
        if (activeProfile) {
          const updated = profiles.map(p =>
            p.id === activeProfile ? { ...p, lastUsed: Date.now() } : p
          )
          localStorage.setItem('tn3270_profiles', JSON.stringify(updated))
          set({ profiles: updated })
        }
      }
      if (s === 'disconnected' || s === 'error') set({ sessionStart: null })
      if ((s === 'disconnected' || s === 'error') && get().autoReconnect) {
        _timer = setTimeout(() => get().connect(_hostRef, _portRef, true, get().activeProfile), 3000)
      }
    }

    _client.onScreen = (scr) => {
      set(prev => {
        const newHistory = [...prev.history, scr].slice(-MAX_HISTORY)
        const { findQuery } = prev
        const findMatches = findQuery ? doFind(scr, findQuery) : []
        return { screen: scr, bytesRx: prev.bytesRx + 1, history: newHistory, historyIdx: -1, findMatches, findCurrent: 0 }
      })
    }

    let _logTimer: ReturnType<typeof setTimeout> | null = null
    _client.onLog = () => {
      if (_logTimer) return
      _logTimer = setTimeout(() => {
        _logTimer = null
        set({ logs: _client?.getLogs() ?? [] })
      }, 200)
    }

    _client.connect(host, port)
  },

  disconnect: () => {
    if (_timer) { clearTimeout(_timer); _timer = null }
    _client?.disconnect(); _client = null
    set({ state: 'disconnected', screen: null, sessionStart: null, bytesRx: 0 })
  },

  // ── History
  historyBack: () => {
    const { history, historyIdx } = get()
    if (history.length === 0) return
    const cur = historyIdx === -1 ? history.length - 1 : historyIdx
    const next = Math.max(0, cur - 1)
    set({ historyIdx: next })
  },
  historyForward: () => {
    const { history, historyIdx } = get()
    if (historyIdx === -1) return
    const next = historyIdx + 1
    if (next >= history.length) { set({ historyIdx: -1 }); return }
    set({ historyIdx: next })
  },
  historyExit: () => set({ historyIdx: -1 }),
  getViewScreen: () => {
    const { screen, history, historyIdx } = get()
    if (historyIdx === -1) return screen
    return history[historyIdx] ?? screen
  },

  // ── Find
  setFind: (q) => {
    const { screen } = get()
    const findMatches = doFind(screen, q)
    set({ findQuery: q, findMatches, findCurrent: 0 })
  },
  findNext: (reverse = false) => {
    const { findMatches, findCurrent } = get()
    if (findMatches.length === 0) return
    const next = reverse
      ? (findCurrent - 1 + findMatches.length) % findMatches.length
      : (findCurrent + 1) % findMatches.length
    set({ findCurrent: next })
  },
  clearFind: () => set({ findQuery: '', findMatches: [], findCurrent: 0 }),

  // ── Macro
  startRecording: (name) => set({ recording: true, recordingSteps: [], recordingName: name }),
  stopRecording: () => {
    const { recordingSteps, recordingName, macros } = get()
    const id = `mac_${Date.now()}`
    const macro: Macro = { id, name: recordingName || `Macro ${macros.length + 1}`, steps: recordingSteps, createdAt: Date.now() }
    const updated = [...macros, macro]
    localStorage.setItem('tn3270_macros', JSON.stringify(updated))
    set({ macros: updated, recording: false, recordingSteps: [], recordingName: '' })
  },
  cancelRecording: () => set({ recording: false, recordingSteps: [], recordingName: '' }),
  saveMacro: (m) => {
    const id = `mac_${Date.now()}`
    const macro: Macro = { ...m, id, createdAt: Date.now() }
    const macros = [...get().macros, macro]
    localStorage.setItem('tn3270_macros', JSON.stringify(macros))
    set({ macros })
    return id
  },
  deleteMacro: (id) => {
    const macros = get().macros.filter(m => m.id !== id)
    localStorage.setItem('tn3270_macros', JSON.stringify(macros))
    set({ macros })
  },
  runMacro: (id) => {
    const { macros } = get()
    const macro = macros.find(m => m.id === id)
    if (!macro) return
    let delay = 0
    for (const step of macro.steps) {
      if (step.type === 'wait') { delay += step.ms; continue }
      const d = delay
      if (step.type === 'key') {
        setTimeout(() => get().sendAid(step.aid), d)
      } else if (step.type === 'type') {
        let charDelay = d
        for (const ch of step.text) {
          setTimeout(() => get().typeChar(ch), charDelay)
          charDelay += 30
        }
        delay = charDelay
        continue
      }
      delay += 50
    }
  },

  // ── AID
  sendAid: (aid) => {
    console.log("[STORE→sendAid] Called with AID:", `0x${aid.toString(16).toUpperCase()}`);
    if (!_client || get().state !== 'connected') {
      console.error("[STORE→sendAid] ✗ Cannot send:", !_client ? "No client" : `State=${get().state}`);
      return;
    }
    const { screen, recording, recordingSteps } = get()
    if (!screen || screen.locked) {
      console.error("[STORE→sendAid] ✗ Cannot send: Screen unavailable or locked");
      return;
    }

    // record
    if (recording) {
      set({ recordingSteps: [...recordingSteps, { type: 'key', aid }] })
    }

    const { cells, cursor } = screen
    const fields: {addr:number; data:number[]}[] = []
    let fieldAddr = -1, fieldData: number[] = [], fieldMod = false
    const flush = () => { if (fieldAddr >= 0 && fieldMod) fields.push({ addr: fieldAddr, data: [...fieldData] }) }
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]
      if (c.isAttr) {
        flush()
        fieldAddr = (i + 1) % cells.length
        fieldData = []
        fieldMod = !c.protected && c.modified
      } else if (fieldAddr >= 0) {
        fieldData.push(a2e(c.char))
        if (c.modified) fieldMod = true
      }
    }
    flush()
    console.log("[STORE→sendAid] Sending:", fields.length, "modified fields, cursor at", cursor);
    _client.sendAid(aid, cursor, fields)
  },

  typeChar: (ch) => {
    console.log("[STORE→typeChar] Character:", JSON.stringify(ch));
    const { screen, recording, recordingSteps } = get()
    if (!screen || screen.locked) {
      console.warn("[STORE→typeChar] ✗ Cannot type: Screen unavailable or locked");
      return
    }
    const { cursor, cells, rows, cols } = screen
    const cell = cells[cursor]
    if (!cell || cell.protected || cell.isAttr) {
      console.warn("[STORE→typeChar] ✗ Cannot type at cursor", cursor, "- cell is protected/attr or missing");
      return
    }

    // record (merge consecutive chars into one 'type' step)
    if (recording) {
      const last = recordingSteps[recordingSteps.length - 1]
      if (last?.type === 'type') {
        set({ recordingSteps: [...recordingSteps.slice(0, -1), { type: 'type', text: last.text + ch }] })
      } else {
        set({ recordingSteps: [...recordingSteps, { type: 'type', text: ch }] })
      }
    }

    const newCells = cells.map((c, i) => i === cursor ? { ...c, char: ch, modified: true } : c)
    for (let i = cursor; i >= 0; i--) {
      if (newCells[i].isAttr) { newCells[i] = { ...newCells[i], modified: true }; break }
    }
    const size = rows * cols
    let next = (cursor + 1) % size
    for (let n = 0; n < size; n++) {
      const nc = newCells[next]
      if (nc && !nc.protected && !nc.isAttr) break
      next = (next + 1) % size
    }
    console.log("[STORE→typeChar] ✓ Character set, cursor moves from", cursor, "to", next);
    set({ screen: { ...screen, cells: newCells, cursor: next } })
    if (_client) (_client as any).cells = newCells
  },

  deleteChar: () => {
    const { screen } = get()
    if (!screen || screen.locked) return
    const { cursor, cells, rows, cols } = screen
    const size = rows * cols
    let faIdx = -1
    for (let i = cursor; i >= 0; i--) { if (cells[i].isAttr) { faIdx = i; break } }
    if (faIdx === -1 || cells[faIdx].protected || cursor === faIdx) return
    let end = Math.min(faIdx + 1, size - 1)
    while (end < size - 1 && !cells[end + 1]?.isAttr) end++
    const nc = cells.map(c => ({ ...c }))
    for (let i = cursor; i < end; i++) nc[i].char = nc[i+1]?.char ?? ' '
    nc[end].char = ' '
    nc[faIdx] = { ...nc[faIdx], modified: true }
    set({ screen: { ...screen, cells: nc } })
    if (_client) (_client as any).cells = nc
  },

  moveCursor: (dir) => {
    const { screen } = get()
    if (!screen || screen.locked) return
    const { cursor, rows, cols } = screen
    const size = rows * cols
    let next = cursor
    if (dir === 'left')  next = (cursor - 1 + size) % size
    if (dir === 'right') next = (cursor + 1) % size
    if (dir === 'up')    next = (cursor - cols + size) % size
    if (dir === 'down')  next = (cursor + cols) % size
    if (dir === 'home')  next = Math.floor(cursor / cols) * cols
    if (dir === 'end')   next = Math.floor(cursor / cols) * cols + cols - 1
    set({ screen: { ...screen, cursor: next } })
  },

  setCursorPos: (pos) => {
    const { screen } = get()
    if (!screen) return
    const clamped = Math.max(0, Math.min(pos, screen.rows * screen.cols - 1))
    set({ screen: { ...screen, cursor: clamped } })
  },

  tabField: (reverse) => {
    const { screen } = get()
    if (!screen || screen.locked) return
    const { cursor, cells } = screen
    const len = cells.length
    if (reverse) {
      let curFA = -1
      for (let i = cursor; i >= 0; i--) { if (cells[i].isAttr) { curFA = i; break } }
      let pos = curFA > 0 ? curFA - 1 : len - 1
      for (let g = 0; g < len; g++) {
        const c = cells[pos]
        if ((c?.isAttr) && !c.protected) break
        pos = (pos - 1 + len) % len
      }
      set({ screen: { ...screen, cursor: (pos + 1) % len } })
    } else {
      let pos = (cursor + 1) % len
      for (let g = 0; g < len; g++) {
        const c = cells[pos]
        if ((c?.isAttr) && !c.protected) break
        pos = (pos + 1) % len
      }
      set({ screen: { ...screen, cursor: (pos + 1) % len } })
    }
  },

  setAutoReconnect: (v) => set({ autoReconnect: v }),

  saveProfile: (p) => {
    const id = `prof_${Date.now()}_${Math.random().toString(36).slice(2,7)}`
    const profile: Profile = { ...p, id, createdAt: Date.now() }
    const profiles = [...get().profiles.filter(x => x.id !== id), profile]
    localStorage.setItem('tn3270_profiles', JSON.stringify(profiles))
    set({ profiles })
    return id
  },

  deleteProfile: (id) => {
    const profiles = get().profiles.filter(p => p.id !== id)
    localStorage.setItem('tn3270_profiles', JSON.stringify(profiles))
    set({ profiles })
  },

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    localStorage.setItem('tn3270_settings', JSON.stringify(settings))
    set({ settings })
  },

  // ── Export
  exportScreen: () => {
    const scr = get().getViewScreen()
    if (!scr) return
    const { rows, cols, cells } = scr
    const lines: string[] = []
    for (let r = 0; r < rows; r++) {
      let line = ''
      for (let c = 0; c < cols; c++) {
        const cell = cells[r * cols + c]
        line += cell.isAttr ? ' ' : (cell.char || ' ')
      }
      lines.push(line.trimEnd())
    }
    const ts = new Date().toISOString().replace(/[:.]/g,'-')
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `screen_${ts}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  },

  exportLog: () => {
    const { logs } = get()
    const ts = new Date().toISOString().replace(/[:.]/g,'-')
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `protocol_${ts}.log`
    a.click()
    URL.revokeObjectURL(a.href)
  },
}))

// convenience re-exports
export { AID_ENTER, AID_CLEAR, AID_PA1, AID_PA2, AID_PA3, AID_PF }
