// Toolkitr WebSocket → TCP Proxy
// Bridges browser WebSocket to mainframe TCP connection

import { WebSocket, WebSocketServer } from 'ws'
import { createServer } from 'http'
import * as net from 'net'
import * as tls from 'tls'

const PORT = parseInt(process.env.PORT || '8080', 10)

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Toolkitr Proxy OK\n')
})

const wss = new WebSocketServer({ server: httpServer })

function ts(): string {
  return new Date().toTimeString().slice(0, 8)
}

function hex(buf: Buffer | Uint8Array): string {
  return Array.from(buf.slice(0, 128))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ')
    + (buf.length > 128 ? ` …+${buf.length - 128}` : '')
}

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '/', `http://localhost`)
  const host   = url.searchParams.get('host') || ''
  const port   = parseInt(url.searchParams.get('port') || '23', 10)
  const secure = url.searchParams.get('secure') === 'true'

  console.log(`[${ts()}] WS connected → ${host}:${port} secure=${secure}`)

  if (!host) {
    ws.close(1008, 'host param required')
    return
  }

  let tcp: net.Socket | null = null
  let wsOpen = true
  let tcpOpen = false

  // ── create TCP connection ─────────────────────────────────────────────
  try {
    tcp = secure
      ? tls.connect(port, host, { rejectUnauthorized: false })
      : net.createConnection(port, host)
  } catch (e) {
    console.error(`[${ts()}] TCP create error:`, e)
    ws.close(1011, 'TCP connect failed')
    return
  }

  tcp.setTimeout(0)           // disable idle timeout — mainframe controls session lifetime
  tcp.setKeepAlive(true, 15000) // OS-level keepalive every 15 s to prevent NAT/firewall drops

  tcp.on('connect', () => {
    tcpOpen = true
    console.log(`[${ts()}] TCP connected ${host}:${port}`)
  })

  // Forward TCP → WebSocket (raw bytes, no modification)
  tcp.on('data', (data: Buffer) => {
    console.log(`[${ts()}] ← TCP ${data.length}B  ${hex(data)}`)
    if (wsOpen && ws.readyState === WebSocket.OPEN) {
      ws.send(data, { binary: true }, (err) => {
        if (err) console.error(`[${ts()}] WS send error:`, err)
      })
    }
  })

  tcp.on('error', (err) => {
    console.error(`[${ts()}] TCP error:`, err.message)
    if (wsOpen) ws.close(1011, `TCP error: ${err.message}`)
  })

  tcp.on('timeout', () => {
    // Should never fire (timeout disabled), but guard anyway
    console.log(`[${ts()}] TCP timeout — ignoring`)
  })

  tcp.on('close', () => {
    tcpOpen = false
    console.log(`[${ts()}] TCP closed`)
    if (wsOpen) ws.close(1000, 'TCP closed')
  })

  tcp.on('end', () => {
    console.log(`[${ts()}] TCP end`)
  })

  // Forward WebSocket → TCP (raw bytes, no modification)
  ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
    if (!tcpOpen || !tcp) return
    let buf: Buffer
    if (Buffer.isBuffer(data))            buf = data
    else if (data instanceof ArrayBuffer) buf = Buffer.from(data)
    else                                  buf = Buffer.concat(data as Buffer[])
    console.log(`[${ts()}] → TCP ${buf.length}B  ${hex(buf)}`)
    tcp.write(buf, (err) => {
      if (err) console.error(`[${ts()}] TCP write error:`, err)
    })
  })

  ws.on('close', (code, reason) => {
    wsOpen = false
    console.log(`[${ts()}] WS closed ${code} ${reason}`)
    if (tcpOpen) tcp?.destroy()
  })

  ws.on('error', (err) => {
    console.error(`[${ts()}] WS error:`, err.message)
    tcp?.destroy()
  })
})

httpServer.listen(PORT, () => {
  console.log(`[${ts()}] TN3270 proxy listening on ws://localhost:${PORT}`)
})
