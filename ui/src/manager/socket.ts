import {$startTimestep, $timestep, resetProgress} from '../store/progress.ts'
import {$apiReady, $generating, $inferencePreview} from '../store/prompt.ts'

// ruian-sg-api.poom.dev = ws://35.247.139.252:8000/ws
const REMOTE_WS_URL = 'wss://ruian-sg-api.poom.dev/ws'

class SocketManager {
  sock: WebSocket
  url = REMOTE_WS_URL

  constructor() {
    this.sock = this.createWs()
  }

  createWs() {
    const ws = new WebSocket(this.url)
    this.sock = ws
    this.addListeners()

    return ws
  }

  markDisconnect() {
    if (this.sock) {
      this.removeListeners()
    }

    $apiReady.set(false)
    $generating.set(false)
    resetProgress()
  }

  addListeners() {
    this.sock.addEventListener('error', this.onError)
    this.sock.addEventListener('open', this.onOpen)
    this.sock.addEventListener('close', this.onClose)
    this.sock.addEventListener('message', this.onMessage)
  }

  removeListeners() {
    this.sock.removeEventListener('error', this.onError)
    this.sock.removeEventListener('open', this.onOpen)
    this.sock.removeEventListener('close', this.onClose)
    this.sock.removeEventListener('message', this.onMessage)
  }

  onError = (event: Event) => {
    console.error('$ websocket error', event)

    this.markDisconnect()
    this.reconnectSoon('websocket error')
  }

  onOpen = () => {
    console.log(`$ websocket connected to "${this.sock.url}"`)

    $apiReady.set(true)
  }

  onClose = () => {
    console.log('$ websocket closed')

    this.markDisconnect()
    this.reconnectSoon('websocket closed', 5000)
  }

  onMessage = (event: MessageEvent) => {
    const data = event.data
    $apiReady.set(true)

    // binary data received - assume JPEG-encoded image
    if (data instanceof Blob) {
      const blob = new Blob([data], {type: 'image/jpeg'})
      const url = URL.createObjectURL(blob)

      $inferencePreview.set(url)

      console.log(`[ws] blob:`, blob.size)
    } else if (typeof data === 'string') {
      const res = data.trim()

      // progress indicator
      if (res.startsWith('p:')) {
        const m = res.match(/p:s=(\d+):t=(\d+)/)

        if (m) {
          const s = parseInt(m[1], 10)
          const t = parseInt(m[2], 10)

          $timestep.set(t)

          if (s === 0) {
            $startTimestep.set(t)
          }
        }
      } else if (res === 'done') {
        $generating.set(false)
        resetProgress()
        console.log(`[ws] done!`)
      } else {
        console.log(`[ws] text: "${res.substring(0, 200)}"`)
      }
    } else {
      console.log(`[ws] unknown:`, event)
    }
  }

  reconnectSoon(reason?: string, delay = 5000, flags?: {shutup?: boolean}) {
    if (!this.sock) return

    $apiReady.set(false)

    // stop listening to inference events
    if (flags?.shutup) {
      this.removeListeners()
    }

    setTimeout(() => {
      console.log(`$ reconnecting due to "${reason}"`)

      this.sock = this.createWs()
    }, delay)
  }

  close() {
    this.sock.close()
    this.markDisconnect()
  }
}

export const socket = new SocketManager()
