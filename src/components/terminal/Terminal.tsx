'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { useStore, AID_ENTER, AID_CLEAR, AID_PA1, AID_PA2, AID_PA3, AID_PF } from '@/store'
import { colorToCss } from '@/lib/terminal/protocol'
import type { Screen } from '@/store'

// ─── Screen renderer ──────────────────────────────────────────────────────────
function buildRows(
  screen: Screen,
  findMatches: number[],
  findCurrent: number,
  queryLen: number
): string {
  const { rows, cols, cells, cursor } = screen

  // pre-compute highlight sets
  const matchSet   = new Set<number>()
  const currentSet = new Set<number>()
  if (queryLen > 0) {
    for (let mi = 0; mi < findMatches.length; mi++) {
      for (let j = 0; j < queryLen; j++) {
        const idx = findMatches[mi] + j
        matchSet.add(idx)
        if (mi === findCurrent) currentSet.add(idx)
      }
    }
  }

  let html = ''
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      const cell = cells[i]

      if (cell.isAttr) {
        html += `<span class="tn-attr" data-i="${i}"> </span>`
        continue
      }

      const isCursor   = i === cursor
      const hidden     = cell.hidden
      const inten      = cell.intensified
      const isMatch    = matchSet.has(i)
      const isCurrent  = currentSet.has(i)

      const fg = cell.fg ? colorToCss(cell.fg) : ''
      const bg = cell.bg ? colorToCss(cell.bg) : ''

      let cls = 'tn-ch'
      if (isCursor)  cls += ' tn-cursor'
      if (hidden)    cls += ' tn-hidden'
      if (inten)     cls += ' tn-inten'
      if (cell.protected)  cls += ' tn-prot'
      if (cell.modified)   cls += ' tn-mod'
      if (isCurrent) cls += ' tn-find-current'
      else if (isMatch) cls += ' tn-find-match'

      const style = [fg ? `color:${fg}` : '', bg ? `background:${bg}` : ''].filter(Boolean).join(';')
      const ch = cell.char === ' ' || cell.char === '' ? '\u00a0' : cell.char
      html += `<span class="${cls}" data-i="${i}"${style ? ` style="${style}"` : ''}>${escHtml(ch)}</span>`
    }
    html += '\n'
  }
  return html
}

function escHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function screenToText(screen: Screen): string {
  const { rows, cols, cells } = screen
  const lines: string[] = []
  for (let r = 0; r < rows; r++) {
    let line = ''
    for (let c = 0; c < cols; c++) {
      const cell = cells[r * cols + c]
      line += cell.isAttr ? ' ' : (cell.char || ' ')
    }
    lines.push(line.trimEnd())
  }
  return lines.join('\n')
}

// ─── Dynamic placeholder ────────────────────────────────────────────────────────
function makePlaceholder(rows: number, cols: number): string {
  const emptyCell = '<span class="tn-ch">\u00a0</span>'
  const row = emptyCell.repeat(cols)
  return (row + '\n').repeat(rows)
}

// IBM Plex Mono character metrics (width/fontSize ratio including letter-spacing 0.04em)
const CHAR_W_RATIO = 0.641   // ≈ 0.601 intrinsic + 0.04 letter-spacing
const LINE_H_RATIO = 1.3

// ─── PF Bar labels ────────────────────────────────────────────────────────────
const PF_LABELS       = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12']
const PF_SHIFT_LABELS = ['F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24']

// ─── Main Terminal component ──────────────────────────────────────────────────
export default function Terminal() {
  const state          = useStore(s => s.state)
  const settings       = useStore(s => s.settings)
  const sendAid        = useStore(s => s.sendAid)
  const typeChar       = useStore(s => s.typeChar)
  const deleteChar     = useStore(s => s.deleteChar)
  const moveCursor     = useStore(s => s.moveCursor)
  const setCursorPos   = useStore(s => s.setCursorPos)
  const tabField       = useStore(s => s.tabField)
  const historyBack    = useStore(s => s.historyBack)
  const historyForward = useStore(s => s.historyForward)
  const historyExit    = useStore(s => s.historyExit)
  const historyIdx     = useStore(s => s.historyIdx)
  const setFind        = useStore(s => s.setFind)
  const findNext       = useStore(s => s.findNext)
  const clearFind      = useStore(s => s.clearFind)
  const findQuery      = useStore(s => s.findQuery)
  const recording      = useStore(s => s.recording)

  const screenRef    = useRef<HTMLPreElement>(null)
  const oiaLockRef   = useRef<HTMLSpanElement>(null)
  const oiaPosRef    = useRef<HTMLSpanElement>(null)
  const oiaMsgRef    = useRef<HTMLSpanElement>(null)
  const oiaDimsRef   = useRef<HTMLSpanElement>(null)
  const findInputRef = useRef<HTMLInputElement>(null)

  const [showFind, setShowFind] = useState(false)
  const [copyMsg,  setCopyMsg]  = useState('')
  const [dims,     setDims]     = useState({ rows: 24, cols: 80 })

  // Stable ref for dims — read inside subscribe without stale closure
  const dimsRef = useRef({ rows: 24, cols: 80 })

  // ── Paint placeholder on mount
  useEffect(() => {
    if (screenRef.current) screenRef.current.innerHTML = makePlaceholder(24, 80)
  }, [])

  // ── Subscribe to screen — direct DOM mutation, zero React re-renders
  useEffect(() => {
    const unsub = useStore.subscribe((st, prev) => {
      const screen     = st.historyIdx === -1 ? st.screen : st.history[st.historyIdx]
      const prevScreen = prev.historyIdx === -1 ? prev.screen : prev.history[prev.historyIdx]

      const screenChanged  = screen !== prevScreen
      const findChanged    = st.findQuery !== prev.findQuery || st.findMatches !== prev.findMatches || st.findCurrent !== prev.findCurrent
      const historyChanged = st.historyIdx !== prev.historyIdx

      if (!screen) return

      // ── Update dims when mainframe sends a different screen size
      if (screenChanged && (screen.rows !== dimsRef.current.rows || screen.cols !== dimsRef.current.cols)) {
        dimsRef.current = { rows: screen.rows, cols: screen.cols }
        setDims({ rows: screen.rows, cols: screen.cols })
      }

      if (screenChanged || findChanged || historyChanged) {
        if (screenRef.current)
          screenRef.current.innerHTML = buildRows(screen, st.findMatches, st.findCurrent, st.findQuery.length)
      }

      if (screenChanged || historyChanged) {
        if (oiaLockRef.current) {
          oiaLockRef.current.className = `tn-oia-lock${screen.locked ? ' active' : ''}`
          oiaLockRef.current.textContent = screen.locked ? '\u232B LOCK' : '\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0'
        }
        if (oiaPosRef.current) {
          const row = Math.floor(screen.cursor / screen.cols) + 1
          const col = screen.cursor % screen.cols + 1
          oiaPosRef.current.textContent = `${String(row).padStart(3,'0')}/${String(col).padStart(3,'0')}`
        }
        if (oiaDimsRef.current) {
          oiaDimsRef.current.textContent = `${screen.rows}\u00D7${screen.cols}`
        }
      }

      if (oiaMsgRef.current) {
        const hIdx   = st.historyIdx
        const hLen   = st.history.length
        const fCount = st.findMatches.length
        const fCur   = st.findCurrent + 1
        let msg = ''
        if (hIdx !== -1) msg = `HISTORY ${hIdx + 1}/${hLen} \u2190\u2192 to navigate  Esc to exit`
        else if (st.findQuery) msg = fCount > 0 ? `Find: ${fCur}/${fCount} matches` : 'Find: no matches'
        else if (st.recording) msg = '\u23FA RECORDING'
        oiaMsgRef.current.textContent = msg
        oiaMsgRef.current.className = `tn-oia-msg${hIdx !== -1 ? ' history' : st.recording ? ' recording' : st.findQuery ? ' finding' : ''}`
      }
    })
    return unsub
  }, [])

  // Focus find input when shown
  useEffect(() => {
    if (showFind) findInputRef.current?.focus()
  }, [showFind])

  // ── Click → cursor position
  const onScreenClick = useCallback((e: React.MouseEvent<HTMLPreElement>) => {
    if (state !== 'connected') return
    const el = e.target as HTMLElement
    // walk up to find a data-i element
    let cur: HTMLElement | null = el
    while (cur && cur !== e.currentTarget) {
      const idx = cur.getAttribute('data-i')
      if (idx !== null) { setCursorPos(parseInt(idx, 10)); return }
      cur = cur.parentElement
    }
  }, [state, setCursorPos])

  // ── Keyboard handler
  const onKey = useCallback((e: KeyboardEvent) => {
    // Skip all terminal key handling when focus is inside a text field
    // (e.g. the AI assistant chat input, settings forms, etc.)
    const active = document.activeElement
    if (active && (
      active.tagName === 'TEXTAREA' ||
      active.tagName === 'INPUT' ||
      active.tagName === 'SELECT' ||
      (active as HTMLElement).isContentEditable
    )) return

    const { key, shiftKey, ctrlKey, altKey } = e

    // Find bar hotkeys
    if (ctrlKey && key === 'f') {
      e.preventDefault()
      setShowFind(true)
      return
    }

    // History navigation
    if (altKey && key === 'ArrowLeft')  { e.preventDefault(); historyBack();    return }
    if (altKey && key === 'ArrowRight') { e.preventDefault(); historyForward(); return }

    if (key === 'Escape') {
      if (showFind) { setShowFind(false); clearFind(); return }
      if (historyIdx !== -1) { e.preventDefault(); historyExit(); return }
      if (state === 'connected') { e.preventDefault(); sendAid(AID_CLEAR) }
      return
    }

    if (state !== 'connected') return

    // Copy screen text
    if (ctrlKey && key === 'c' && !window.getSelection()?.toString()) {
      const scr = useStore.getState().getViewScreen()
      if (scr) {
        navigator.clipboard.writeText(screenToText(scr)).then(() => {
          setCopyMsg('Copied!')
          setTimeout(() => setCopyMsg(''), 1500)
        })
      }
      return
    }

    // PF keys
    if (key.startsWith('F') && !isNaN(Number(key.slice(1)))) {
      const n = Number(key.slice(1))
      if (n >= 1 && n <= 12) { e.preventDefault(); sendAid(AID_PF[shiftKey ? n + 12 : n]); return }
    }

    switch (key) {
      case 'Enter':      e.preventDefault(); sendAid(AID_ENTER);               return
      case 'Delete':     e.preventDefault(); deleteChar();                     return
      case 'Backspace':  e.preventDefault(); moveCursor('left'); deleteChar(); return
      case 'ArrowLeft':  e.preventDefault(); moveCursor('left');               return
      case 'ArrowRight': e.preventDefault(); moveCursor('right');              return
      case 'ArrowUp':    e.preventDefault(); moveCursor('up');                 return
      case 'ArrowDown':  e.preventDefault(); moveCursor('down');               return
      case 'Home':       e.preventDefault(); moveCursor('home');               return
      case 'End':        e.preventDefault(); moveCursor('end');                return
      case 'Tab':        e.preventDefault(); tabField(shiftKey);               return
    }

    if (altKey) {
      if (key === '1') { e.preventDefault(); sendAid(AID_PA1); return }
      if (key === '2') { e.preventDefault(); sendAid(AID_PA2); return }
      if (key === '3') { e.preventDefault(); sendAid(AID_PA3); return }
    }

    if (!ctrlKey && !altKey && key.length === 1) { e.preventDefault(); typeChar(key) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, sendAid, typeChar, deleteChar, moveCursor, tabField, historyBack, historyForward, historyExit, historyIdx, showFind, clearFind])

  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  // Pixel dimensions of the <pre> — bezel shrink-wraps the exact screen size
  const screenPxW = Math.round(dims.cols * (settings.fontSize * CHAR_W_RATIO) + 28)
  const screenPxH = Math.round(dims.rows * (settings.fontSize * LINE_H_RATIO) + 16)

  const oiaStateText =
    state === 'connecting'  ? 'CONNECTING\u2026' :
    state === 'negotiating' ? 'NEGOTIATING\u2026' :
    state === 'error'       ? '\u26a0 ERROR' :
    state === 'disconnected' ? 'NOT CONNECTED' : ''

  return (
    <div className="tn-wrap" data-theme={settings.theme}>
      <div className="tn-monitor-container">
        <div className="tn-bezel">
          <div className="tn-screen-well">

            {/* History overlay badge */}
            {historyIdx !== -1 && (
              <div className="tn-history-badge">
                HISTORY MODE &nbsp;·&nbsp; Alt+\u2194
                <button className="tn-history-exit" onClick={historyExit}>Exit \u00d7</button>
              </div>
            )}

            {/* Copy feedback */}
            {copyMsg && <div className="tn-copy-toast">{copyMsg}</div>}

            {/* Recording badge */}
            {recording && <div className="tn-recording-badge">\u23FA REC</div>}

            {/* Screen — auto-sized to fit container, click positions cursor */}
            <pre
              ref={screenRef}
              className={`tn-screen${settings.showScanlines ? '' : ' no-scan'}${historyIdx !== -1 ? ' tn-screen-history' : ''}`}
              style={{ fontSize: `${settings.fontSize}px`, width: `${screenPxW}px`, height: `${screenPxH}px` }}
              tabIndex={0}
              onClick={onScreenClick}
            />

            {/* Find bar */}
            {showFind && (
              <div className="tn-find-bar">
                <span className="tn-find-label">Find:</span>
                <input
                  ref={findInputRef}
                  className="tn-find-input"
                  value={findQuery}
                  placeholder="Search screen…"
                  onChange={e => setFind(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  { e.preventDefault(); findNext(e.shiftKey) }
                    if (e.key === 'Escape') { setShowFind(false); clearFind() }
                  }}
                />
                <span className="tn-find-count">
                  {useStore.getState().findMatches.length > 0
                    ? `${useStore.getState().findCurrent + 1}/${useStore.getState().findMatches.length}`
                    : findQuery ? '0' : ''}
                </span>
                <button className="tn-find-btn" onClick={() => findNext(false)} title="Next (Enter)">\u2193</button>
                <button className="tn-find-btn" onClick={() => findNext(true)}  title="Prev (Shift+Enter)">\u2191</button>
                <button className="tn-find-btn" onClick={() => { setShowFind(false); clearFind() }} title="Close (Esc)">\u00d7</button>
              </div>
            )}

            {/* OIA bar */}
            <div className="tn-oia">
              <span ref={oiaLockRef} className="tn-oia-lock">
                {'\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0'}
              </span>
              <span ref={oiaMsgRef} className="tn-oia-msg" />
              <span className="tn-oia-mid">
                {oiaStateText}
                {state === 'connected' && (
                  <><span className="tn-oia-term">IBM-3278-2-E</span>&nbsp;&nbsp;<span ref={oiaDimsRef} className="tn-oia-dims">{dims.rows}\u00D7{dims.cols}</span></>
                )}
              </span>
              <span ref={oiaPosRef} className="tn-oia-pos">---/---</span>
            </div>
          </div>
        </div>

        {/* PF bar */}
        {settings.showPfBar && (
          <div className="tn-pfbar" style={{ width: `${screenPxW + 32}px` }}>
            <div className="tn-pfrow">
              {PF_LABELS.map((lbl, i) => (
                <button key={lbl} className="tn-pfkey"
                  onMouseDown={e => { e.preventDefault(); sendAid(AID_PF[i + 1]) }} title={`PF${i+1}`}>
                  {lbl}
                </button>
              ))}
              <button className="tn-pfkey tn-pa"    onMouseDown={e=>{e.preventDefault();sendAid(AID_PA1)}}>PA1</button>
              <button className="tn-pfkey tn-pa"    onMouseDown={e=>{e.preventDefault();sendAid(AID_PA2)}}>PA2</button>
              <button className="tn-pfkey tn-pa"    onMouseDown={e=>{e.preventDefault();sendAid(AID_PA3)}}>PA3</button>
              <button className="tn-pfkey tn-enter" onMouseDown={e=>{e.preventDefault();sendAid(AID_ENTER)}}>ENTER</button>
              <button className="tn-pfkey tn-clear" onMouseDown={e=>{e.preventDefault();sendAid(AID_CLEAR)}}>CLEAR</button>
            </div>
            {settings.showShiftRow && (
              <div className="tn-pfrow tn-pfrow-shift">
                {PF_SHIFT_LABELS.map((lbl, i) => (
                  <button key={lbl} className="tn-pfkey tn-shift"
                    onMouseDown={e => { e.preventDefault(); sendAid(AID_PF[i + 13]) }}
                    title={`PF${i+13} (Shift+F${i+1})`}>
                    {lbl}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
