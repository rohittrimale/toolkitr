// TN3270Connection — full TN3270 client running over a WebSocket→TCP proxy
import {
  IAC, SE, SB, WILL, WONT, DO, DONT, EOR,
  OPT_BINARY, OPT_ECHO, OPT_SGA, OPT_EOR, OPT_TERMINAL_TYPE, OPT_TN3270E, OPT_TIMING_MARK,
  CMD_W, CMD_RB, CMD_EW, CMD_RM, CMD_EWA, CMD_RMA, CMD_EAU, CMD_WSF,
  CMD_W_ALT, CMD_EW_ALT, CMD_EWA_ALT,
  ORDER_SF, ORDER_SFE, ORDER_MF, ORDER_SA, ORDER_SBA,
  ORDER_IC, ORDER_PT, ORDER_RA, ORDER_EUA, ORDER_GE,
  ATTR_PROTECTED, ATTR_NUMERIC, ATTR_DISP_MASK, ATTR_DISP_HIGH,
  ATTR_DISP_ZERO, ATTR_MDT,
  EXT_3270_FIELD, EXT_HIGHLIGHT, EXT_FG_COLOR, EXT_BG_COLOR,
  HL_BLINK, HL_REVERSE, HL_UNDERSCORE,
  AID_NO_AID, AID_ENTER, AID_CLEAR, AID_PA1, AID_PA2, AID_PA3, AID_PF,
  SF_READ_PARTITION, SF_QUERY_REPLY,
  RP_QUERY, RP_QUERY_LIST,
  QR_SUMMARY, QR_USABLE_AREA, QR_COLOR, QR_HIGHLIGHT, QR_REPLY_MODES, QR_IMPLICIT_PART,
  e2a, a2e, decodeAddr, encodeAddr,
} from './protocol'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Cell {
  char: string
  isAttr: boolean       // field attribute byte marker
  attrByte: number
  protected: boolean
  numeric: boolean
  intensified: boolean
  hidden: boolean
  modified: boolean
  fg: number            // 0=default, else 3270 color code
  bg: number
  hl: number            // HL_* constant
}

export interface Screen {
  rows: number
  cols: number
  cells: Cell[]
  cursor: number
  locked: boolean       // keyboard locked
}

export type ConnState = 'disconnected' | 'connecting' | 'negotiating' | 'connected' | 'error'

export type OnState  = (s: ConnState) => void
export type OnScreen = (s: Screen) => void
export type OnLog    = (line: string) => void

// ── Helpers ───────────────────────────────────────────────────────────────────
function mkCell(): Cell {
  return { char:' ', isAttr:false, attrByte:0, protected:false, numeric:false,
           intensified:false, hidden:false, modified:false, fg:0, bg:0, hl:0 }
}
function h2(n: number) { return n.toString(16).padStart(2,'0').toUpperCase() }
function hd(d: Uint8Array) {
  const a = Array.from(d.slice(0,64)).map(h2).join(' ')
  return d.length > 64 ? a + ` …+${d.length-64}` : a
}
const OPT_NAME: Record<number,string> = {
  0x00:'BINARY',0x01:'ECHO',0x03:'SGA',0x18:'TERM-TYPE',0x19:'EOR',0x28:'TN3270E'
}
const CMD_NAME: Record<number,string> = {
  0xFB:'WILL',0xFC:'WONT',0xFD:'DO',0xFE:'DONT',0xFA:'SB',0xF0:'SE',0xEF:'EOR',0xFF:'IAC',
}

// ── Main class ────────────────────────────────────────────────────────────────
export class TN3270Client {
  onState:  OnState  = () => {}
  onScreen: OnScreen = () => {}
  onLog:    OnLog    = () => {}

  private ws:    WebSocket | null = null
  private buf:   number[]  = []
  private rows   = 24
  private cols   = 80
  private cells: Cell[]    = []
  private cursor = 0
  private locked = true
  private state: ConnState = 'disconnected'
  private logs:  string[]  = []

  private neg = {
    binaryWill:false, binaryDo:false,
    eorWill:false,    eorDo:false,
    sgaWill:false,    sgaDo:false,
    ttypeSent:false,  tn3270eRefused:false,
  }
  private negotiated = false
  private nvt = false

  constructor(private termType = 'IBM-3278-2-E') {
    this.initScreen()
  }

  // ── Public ────────────────────────────────────────────────────────────────
  connect(host: string, port: number, secure = false) {
    if (this.ws) this.ws.close()
    this.neg = { binaryWill:false, binaryDo:false, eorWill:false, eorDo:false,
                 sgaWill:false, sgaDo:false, ttypeSent:false, tn3270eRefused:false }
    this.negotiated = false
    this.nvt = false
    this.locked = true
    this.buf = []
    this.initScreen()

    const url = `ws://localhost:8080/tn3270?host=${encodeURIComponent(host)}&port=${port}&secure=${secure}`
    this.log(`Connecting → ${host}:${port}`)
    this.setState('connecting')

    this.ws = new WebSocket(url)
    this.ws.binaryType = 'arraybuffer'

    this.ws.onopen = () => {
      this.log('WS open — sending initial WILL/DO')
      this.setState('negotiating')
      this.sendRaw([
        IAC, WILL, OPT_BINARY,
        IAC, WILL, OPT_EOR,
        IAC, DO,   OPT_BINARY,
        IAC, DO,   OPT_EOR,
        IAC, DO,   OPT_TERMINAL_TYPE,
      ])
    }

    this.ws.onmessage = (ev) => {
      const d = new Uint8Array(ev.data as ArrayBuffer)
      this.log(`← ${d.length}B  ${hd(d)}`)
      d.forEach(b => this.buf.push(b))
      this.processBuf()
    }

    this.ws.onclose = (ev) => {
      this.log(`WS closed ${ev.code}`)
      this.setState('disconnected')
      this.ws = null
    }

    this.ws.onerror = () => {
      this.log('WS error')
      this.setState('error')
    }
  }

  disconnect() {
    this.ws?.close()
    this.ws = null
    this.setState('disconnected')
  }

  getState()  { return this.state }
  getLogs()   { return [...this.logs] }

  sendAid(aid: number, cursor: number, fields: {addr: number; data: number[]}[]) {
    if (!this.negotiated) return
    this.locked = true
    this.emitScreen()
    const out: number[] = [aid]
    const [ch, cl] = encodeAddr(cursor)
    out.push(ch, cl)
    for (const f of fields) {
      out.push(ORDER_SBA)
      const [fh, fl] = encodeAddr(f.addr)
      out.push(fh, fl, ...f.data)
    }
    this.send3270(out)
    this.log(`→ AID ${h2(aid)} cursor=${cursor} fields=${fields.length}`)
  }

  getCells() { return this.cells }

  // ── Buffer processor ──────────────────────────────────────────────────────
  private processBuf() {
    while (this.buf.length > 0) {
      if (this.buf[0] !== IAC) {
        // gather until IAC
        const iacAt = this.buf.indexOf(IAC)
        if (iacAt === -1) break
        const rec = this.buf.splice(0, iacAt)
        if (rec.length > 0) {
          this.nvt ? this.doNVT(rec) : this.do3270(new Uint8Array(rec))
        }
        continue
      }
      // IAC command
      if (this.buf.length < 2) break
      const cmd = this.buf[1]
      if (cmd === IAC) { this.buf.splice(0, 2); continue } // escaped 0xFF
      if (cmd === EOR) { this.buf.splice(0, 2); continue }
      if (cmd === SB) {
        const seAt = this.findSE()
        if (seAt === -1) break
        const sf = this.buf.slice(2, seAt)
        this.buf.splice(0, seAt + 2)
        this.doSB(sf)
        continue
      }
      if (cmd === WILL || cmd === WONT || cmd === DO || cmd === DONT) {
        if (this.buf.length < 3) break
        const opt = this.buf[2]
        this.buf.splice(0, 3)
        this.doNeg(cmd, opt)
        continue
      }
      this.buf.splice(0, 2)
    }
  }

  private findSE(): number {
    for (let i = 2; i < this.buf.length - 1; i++) {
      if (this.buf[i] === IAC && this.buf[i+1] === SE) return i
    }
    return -1
  }

  // ── Telnet negotiation ────────────────────────────────────────────────────
  private doNeg(cmd: number, opt: number) {
    const o = OPT_NAME[opt] ?? h2(opt)
    const c = CMD_NAME[cmd] ?? h2(cmd)
    this.log(`← IAC ${c} ${o}`)

    switch (opt) {
      case OPT_TN3270E:
        this.sendRaw([IAC, WONT, OPT_TN3270E])
        this.log('→ WONT TN3270E')
        if (!this.neg.tn3270eRefused) {
          this.neg.tn3270eRefused = true
          this.sendRaw([IAC,WILL,OPT_BINARY, IAC,WILL,OPT_EOR,
                        IAC,DO,OPT_BINARY,   IAC,DO,OPT_EOR])
          this.log('→ re-asserting BINARY+EOR')
        }
        break

      case OPT_BINARY:
        if (cmd === DO)   { this.neg.binaryWill = true; this.sendRaw([IAC,WILL,OPT_BINARY]); this.log('→ WILL BINARY') }
        if (cmd === WILL) { this.neg.binaryDo   = true; this.sendRaw([IAC,DO,OPT_BINARY]);   this.log('→ DO BINARY') }
        if (cmd === DONT) { this.neg.binaryWill = false; this.sendRaw([IAC,WONT,OPT_BINARY]); this.nvt = true }
        if (cmd === WONT) { this.neg.binaryDo   = false; this.nvt = true }
        this.checkNeg()
        break

      case OPT_EOR:
        if (cmd === DO)   { this.neg.eorWill = true; this.sendRaw([IAC,WILL,OPT_EOR]); this.log('→ WILL EOR') }
        if (cmd === WILL) { this.neg.eorDo   = true; this.sendRaw([IAC,DO,OPT_EOR]);   this.log('→ DO EOR') }
        this.checkNeg()
        break

      case OPT_TERMINAL_TYPE:
        if (cmd === DO) {
          this.sendRaw([IAC,WILL,OPT_TERMINAL_TYPE])
          this.log('→ WILL TERM-TYPE')
        }
        break

      case OPT_SGA:
        if (cmd === DO)   { this.neg.sgaWill = true; this.sendRaw([IAC,WILL,OPT_SGA]) }
        if (cmd === WILL) { this.neg.sgaDo   = true; this.sendRaw([IAC,DO,OPT_SGA]) }
        break

      case OPT_ECHO:
        if (cmd === DO)   this.sendRaw([IAC,WONT,OPT_ECHO])
        if (cmd === WILL) this.sendRaw([IAC,DONT,OPT_ECHO])
        break

      case OPT_TIMING_MARK:
        // Mainframe uses TIMING-MARK as an application-level keepalive probe.
        // Respond with the mirrored command so the mainframe knows we are alive.
        if (cmd === DO)   { this.sendRaw([IAC, WILL, OPT_TIMING_MARK]); this.log('→ WILL TIMING-MARK (keepalive)') }
        if (cmd === WILL) { this.sendRaw([IAC, DO,   OPT_TIMING_MARK]); this.log('→ DO TIMING-MARK (keepalive)') }
        break

      default:
        if (cmd === DO)   this.sendRaw([IAC,WONT,opt])
        if (cmd === WILL) this.sendRaw([IAC,DONT,opt])
        this.log(`→ refusing ${o}`)
    }
  }

  private doSB(sf: number[]) {
    if (!sf.length) return
    const opt = sf[0]
    this.log(`← IAC SB ${OPT_NAME[opt]??h2(opt)} [${sf.map(h2).join(' ')}] SE`)
    if (opt === OPT_TERMINAL_TYPE && sf[1] === 0x01) this.sendTermType()
  }

  private sendTermType() {
    if (this.neg.ttypeSent) return
    this.neg.ttypeSent = true
    const name = Array.from(this.termType).map(c => c.charCodeAt(0))
    this.sendRaw([IAC, SB, OPT_TERMINAL_TYPE, 0x00, ...name, IAC, SE])
    this.log(`→ TERM-TYPE IS "${this.termType}"`)
  }

  private checkNeg() {
    if (this.negotiated) return
    if (this.neg.binaryWill && this.neg.binaryDo &&
        this.neg.eorWill    && this.neg.eorDo) {
      this.negotiated = true
      this.nvt = false
      this.log('✅ TN3270 negotiated — binary+EOR active')
      this.setState('connected')
    }
  }

  // ── NVT ───────────────────────────────────────────────────────────────────
  private doNVT(data: number[]) {
    this.log(`NVT: ${data.map(h2).join(' ')}`)
    for (const b of data) {
      if (b === 0x0D || b === 0x0A) {
        const r = Math.floor(this.cursor / this.cols)
        if (r < this.rows - 1) this.cursor = (r + 1) * this.cols
      } else if (b >= 0x20 && b < 0x7F) {
        if (this.cursor < this.cells.length) {
          this.cells[this.cursor].char = String.fromCharCode(b)
          this.cursor = (this.cursor + 1) % (this.rows * this.cols)
        }
      }
    }
    this.emitScreen()
  }

  // ── 3270 command dispatcher ────────────────────────────────────────────────
  private do3270(d: Uint8Array) {
    if (!d.length) return
    const cmd = d[0]
    this.log(`3270 CMD ${h2(cmd)} (${d.length}B)`)
    switch (cmd) {
      case CMD_W:  case CMD_W_ALT:   this.doWrite(d, false, false); break
      case CMD_EW: case CMD_EW_ALT:  this.doWrite(d, true,  false); break
      case CMD_EWA:case CMD_EWA_ALT: this.doWrite(d, true,  true);  break
      case CMD_EAU:                  this.doEAU();                   break
      case CMD_WSF:                  this.doWSF(d.slice(1));         break
      case CMD_RM:                   this.doRM(false);               break
      case CMD_RMA:                  this.doRM(true);                break
      case CMD_RB:                   this.doRB();                    break
      default: this.log(`Unknown cmd ${h2(cmd)}`)
    }
  }

  // ── Write / Erase-Write ───────────────────────────────────────────────────
  private doWrite(d: Uint8Array, erase: boolean, alt: boolean) {
    if (d.length < 2) return
    const wcc = d[1]
    this.log(`  WCC=${h2(wcc)} erase=${erase} alt=${alt}`)

    if (erase) {
      this.initScreen(alt ? 27 : 24, alt ? 132 : 80)
      this.cursor = 0
    }

    // WCC bit 0 (0x01) | bit 6 (0x40) = reset MDT
    if (wcc & 0x41) {
      for (const c of this.cells) {
        if (c.isAttr) { c.modified = false; c.attrByte &= ~ATTR_MDT }
      }
    }

    // Always lock keyboard on incoming write; unlock when WCC bit 1 (0x02) set
    this.locked = true
    this.doOrders(d.slice(2))
    this.propagate()

    if (wcc & 0x02) { this.locked = false; this.log('  ⌨ keyboard unlocked') }
    if (wcc & 0x04) { this.log('  ⚠ ALARM') }

    this.emitScreen()
  }

  // Forward-propagate protection/display attrs from SF cells to data cells
  private propagate() {
    const n = this.cells.length
    const first = this.cells.findIndex(c => c.isAttr)
    if (first === -1) return

    let prot = false, num = false, inten = false, hid = false
    let fg = 0, bg = 0, hl = 0

    for (let j = 0; j < n; j++) {
      const i = (first + j) % n
      const c = this.cells[i]
      if (c.isAttr) {
        const a = c.attrByte
        const disp = a & ATTR_DISP_MASK
        prot  = !!(a & ATTR_PROTECTED)
        num   = !!(a & ATTR_NUMERIC)
        inten = disp === ATTR_DISP_HIGH
        hid   = disp === ATTR_DISP_ZERO
        fg = c.fg; bg = c.bg; hl = c.hl
      } else {
        c.protected   = prot
        c.numeric     = num
        c.intensified = inten
        c.hidden      = hid
        if (!c.fg) c.fg = fg
        if (!c.bg) c.bg = bg
        if (!c.hl) c.hl = hl
      }
    }
  }

  // ── Order processor ───────────────────────────────────────────────────────
  private doOrders(d: Uint8Array) {
    const sz = this.rows * this.cols
    let pos = 0, addr = 0
    let fg = 0, bg = 0, hl = 0

    while (pos < d.length) {
      const b = d[pos++]
      switch (b) {
        case ORDER_SF: {
          const attr = d[pos++] ?? 0
          const c = this.cells[addr % sz]
          c.isAttr = true; c.attrByte = attr; c.char = ' '
          const disp = attr & ATTR_DISP_MASK
          c.protected   = !!(attr & ATTR_PROTECTED)
          c.numeric     = !!(attr & ATTR_NUMERIC)
          c.intensified = disp === ATTR_DISP_HIGH
          c.hidden      = disp === ATTR_DISP_ZERO
          c.modified    = !!(attr & ATTR_MDT)
          c.fg = fg; c.bg = bg; c.hl = hl
          addr = (addr + 1) % sz
          break
        }
        case ORDER_SFE: {
          const cnt = d[pos++] ?? 0
          let newAttr = 0, nfg = fg, nbg = bg, nhl = hl
          for (let i = 0; i < cnt; i++) {
            const t = d[pos++] ?? 0, v = d[pos++] ?? 0
            if (t === EXT_3270_FIELD) newAttr = v
            else if (t === EXT_FG_COLOR)  nfg = v
            else if (t === EXT_BG_COLOR)  nbg = v
            else if (t === EXT_HIGHLIGHT) nhl = v
          }
          const c = this.cells[addr % sz]
          c.isAttr = true; c.attrByte = newAttr; c.char = ' '
          const disp = newAttr & ATTR_DISP_MASK
          c.protected   = !!(newAttr & ATTR_PROTECTED)
          c.numeric     = !!(newAttr & ATTR_NUMERIC)
          c.intensified = disp === ATTR_DISP_HIGH
          c.hidden      = disp === ATTR_DISP_ZERO
          c.modified    = !!(newAttr & ATTR_MDT)
          c.fg = nfg; c.bg = nbg; c.hl = nhl
          fg = nfg; bg = nbg; hl = nhl
          addr = (addr + 1) % sz
          break
        }
        case ORDER_SA: {
          const t = d[pos++] ?? 0, v = d[pos++] ?? 0
          if (t === EXT_3270_FIELD) {}
          else if (t === EXT_FG_COLOR)  fg = v
          else if (t === EXT_BG_COLOR)  bg = v
          else if (t === EXT_HIGHLIGHT) hl = v
          break
        }
        case ORDER_MF: {
          const cnt = d[pos++] ?? 0
          const c = this.cells[addr % sz]
          for (let i = 0; i < cnt; i++) {
            const t = d[pos++] ?? 0, v = d[pos++] ?? 0
            if (t === EXT_3270_FIELD) {
              c.attrByte = v
              c.protected   = !!(v & ATTR_PROTECTED)
              c.intensified = (v & ATTR_DISP_MASK) === ATTR_DISP_HIGH
              c.hidden      = (v & ATTR_DISP_MASK) === ATTR_DISP_ZERO
              c.modified    = !!(v & ATTR_MDT)
            } else if (t === EXT_FG_COLOR)  c.fg = v
              else if (t === EXT_BG_COLOR)  c.bg = v
              else if (t === EXT_HIGHLIGHT) c.hl = v
          }
          break
        }
        case ORDER_SBA: {
          const hi = d[pos++] ?? 0, lo = d[pos++] ?? 0
          addr = decodeAddr(hi, lo) % sz
          break
        }
        case ORDER_IC:
          this.cursor = addr % sz
          break
        case ORDER_PT: {
          for (let i = 0; i < sz; i++) {
            addr = (addr + 1) % sz
            const c = this.cells[addr]
            if (c.isAttr && !c.protected) { addr = (addr + 1) % sz; break }
          }
          break
        }
        case ORDER_RA: {
          const hi = d[pos++]??0, lo = d[pos++]??0, ch = d[pos++]??0
          const end = decodeAddr(hi,lo) % sz
          const char = e2a(ch)
          while (addr !== end) {
            const c = this.cells[addr]
            c.char = char; c.isAttr = false
            c.fg = fg; c.bg = bg; c.hl = hl
            addr = (addr + 1) % sz
          }
          break
        }
        case ORDER_EUA: {
          const hi = d[pos++]??0, lo = d[pos++]??0
          const end = decodeAddr(hi,lo) % sz
          let cur = addr
          while (cur !== end) {
            const c = this.cells[cur]
            if (!c.protected && !c.isAttr) { c.char = ' '; c.modified = false }
            cur = (cur + 1) % sz
          }
          addr = end
          break
        }
        case ORDER_GE: {
          const gc = d[pos++] ?? 0
          const c = this.cells[addr % sz]
          c.char = e2a(gc); c.isAttr = false
          c.fg = fg; c.bg = bg; c.hl = hl
          addr = (addr + 1) % sz
          break
        }
        default:
          // Data bytes: null(0x00) = space+advance, printable EBCDIC >= 0x40
          if (b === 0x00 || b >= 0x40) {
            const c = this.cells[addr % sz]
            c.char = b === 0 ? ' ' : e2a(b)
            c.isAttr = false
            c.fg = fg; c.bg = bg; c.hl = hl
            addr = (addr + 1) % sz
          }
          break
      }
    }
  }

  // ── EAU ──────────────────────────────────────────────────────────────────
  private doEAU() {
    for (const c of this.cells) {
      if (!c.isAttr && !c.protected) { c.char = ' '; c.modified = false }
    }
    this.emitScreen()
  }

  // ── WSF ──────────────────────────────────────────────────────────────────
  private doWSF(d: Uint8Array) {
    let pos = 0
    while (pos + 2 < d.length) {
      const len = (d[pos] << 8) | d[pos+1]
      if (len < 3 || pos + len > d.length) break
      const type = d[pos+2]
      const body = d.slice(pos+3, pos+len)
      pos += len
      this.log(`  WSF type=${h2(type)}`)
      if (type === SF_READ_PARTITION) {
        const op = body[1] ?? 0
        if (op === RP_QUERY || op === RP_QUERY_LIST) this.sendQR()
      }
    }
  }

  private sendQR() {
    this.log('→ Query Reply')
    const cols = this.cols, rows = this.rows
    const p: number[] = []

    // Summary
    p.push(0x00,0x09, SF_QUERY_REPLY, QR_SUMMARY,
           QR_USABLE_AREA, QR_COLOR, QR_HIGHLIGHT, QR_REPLY_MODES, QR_IMPLICIT_PART)

    // Usable Area
    p.push(0x00,0x1B, SF_QUERY_REPLY, QR_USABLE_AREA,
           0x01, 0x00,0x18, 0x00,0x50, 0x01,
           0x00,0x06, 0x00,0x01, 0x00,0x08, 0x00,0x01,
           (cols>>8)&0xFF, cols&0xFF,
           (rows>>8)&0xFF, rows&0xFF,
           0x00, (cols*rows>>8)&0xFF, cols*rows&0xFF)

    // Color
    p.push(0x00,0x16, SF_QUERY_REPLY, QR_COLOR, 0x00, 0x08,
           0xF0,0xF0, 0xF1,0xF1, 0xF2,0xF2, 0xF3,0xF3,
           0xF4,0xF4, 0xF5,0xF5, 0xF6,0xF6, 0xF7,0xF7)

    // Highlight
    p.push(0x00,0x0D, SF_QUERY_REPLY, QR_HIGHLIGHT, 0x04,
           0x00,0xF0, 0xF1,0xF1, 0xF2,0xF2, 0xF4,0xF4)

    // Reply Modes
    p.push(0x00,0x05, SF_QUERY_REPLY, QR_REPLY_MODES, 0x00)

    // Implicit Partition
    p.push(0x00,0x11, SF_QUERY_REPLY, QR_IMPLICIT_PART, 0x00,0x00,
           0x00,0x0B, 0x01, 0x00,0x08,
           0x00, cols&0xFF, 0x00, rows&0xFF,
           0x00, cols&0xFF, 0x00, rows&0xFF)

    this.send3270([CMD_WSF, ...p])
  }

  // ── Read Modified ─────────────────────────────────────────────────────────
  private doRM(all: boolean) {
    this.log(`← RM ${all?'All':''}`)
    const out: number[] = [AID_NO_AID]
    const [ch,cl] = encodeAddr(this.cursor)
    out.push(ch, cl)
    const n = this.cells.length
    for (let i = 0; i < n; i++) {
      const c = this.cells[i]
      if (!c.isAttr) continue
      if (!c.modified && !all) continue
      if (c.protected) continue
      out.push(ORDER_SBA)
      const [fh,fl] = encodeAddr((i+1)%n)
      out.push(fh, fl)
      let j = (i+1) % n
      for (let g = 0; g < n-1 && !this.cells[j].isAttr; g++, j=(j+1)%n) {
        out.push(a2e(this.cells[j].char))
      }
    }
    this.send3270(out)
  }

  // ── Read Buffer ───────────────────────────────────────────────────────────
  private doRB() {
    this.log('← RB')
    const out: number[] = [AID_NO_AID]
    const [ch,cl] = encodeAddr(this.cursor)
    out.push(ch, cl)
    for (const c of this.cells) {
      if (c.isAttr) out.push(ORDER_SF, (c.attrByte & 0x3F) | 0x40)
      else          out.push(a2e(c.char))
    }
    this.send3270(out)
  }

  // ── Send helpers ──────────────────────────────────────────────────────────
  private send3270(data: number[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const esc: number[] = []
    for (const b of data) { esc.push(b); if (b === IAC) esc.push(IAC) }
    esc.push(IAC, EOR)
    this.ws.send(new Uint8Array(esc).buffer)
    this.log(`→ 3270 ${data.length}B  ${hd(new Uint8Array(data))}`)
  }

  private sendRaw(bytes: number[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(new Uint8Array(bytes).buffer)
  }

  // ── Screen helpers ────────────────────────────────────────────────────────
  private initScreen(r = 24, c = 80) {
    this.rows = r; this.cols = c
    this.cells = Array.from({ length: r * c }, mkCell)
    this.cursor = 0
  }

  private emitScreen() {
    this.onScreen({
      rows: this.rows, cols: this.cols,
      cells: [...this.cells],
      cursor: this.cursor,
      locked: this.locked,
    })
  }

  private setState(s: ConnState) {
    if (this.state === s) return
    this.state = s
    this.log(`state → ${s}`)
    this.onState(s)
  }

  private log(msg: string) {
    const line = `[${new Date().toTimeString().slice(0,8)}] ${msg}`
    this.logs.push(line)
    if (this.logs.length > 600) this.logs.shift()
    console.log('[TN3270]', msg)
    this.onLog(line)
  }
}
