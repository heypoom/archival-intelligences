import {$disconnected, $exhibitionMode} from '../store/exhibition'
import {$startTimestep, $timestep, resetProgress} from '../store/progress'
import {$apiReady, $generating, $inferencePreview} from '../store/prompt'

/** After 8 seconds of no activity, consider the connection dead */
const DISCONNECT_TIMEOUT = 8 * 1000

const EXHIBITION_ENDPOINT = 'wss://ruian-sg-api.poom.dev/ws'
const LIVE_LECTURE_ENDPOINT = 'wss://live-lecture-api.poom.dev/ws'

class SocketManager {
  sock: WebSocket
  disconnectTimer?: number

  constructor() {
    this.sock = this.createWs()
  }

  get url(): string {
    if ($exhibitionMode.get()) {
      return EXHIBITION_ENDPOINT
    } else {
      return LIVE_LECTURE_ENDPOINT
    }
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

    if (this.disconnectTimer === undefined) {
      this.disconnectTimer = setTimeout(() => {
        // connection is dead
        console.log(`[ws] websocket connection dead`)
        $disconnected.set(true)
      }, DISCONNECT_TIMEOUT)
    }
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
    console.error('[ws] websocket error', event)

    this.markDisconnect()
    this.reconnectSoon('websocket error')
  }

  onOpen = () => {
    console.log(`[ws] websocket connected to "${this.sock.url}"`)

    this.markAlive()
  }

  onClose = () => {
    console.log('[ws] websocket closed')

    this.markDisconnect()
    this.reconnectSoon('websocket closed', 5000)
  }

  onMessage = (event: MessageEvent) => {
    this.markAlive()

    const data = event.data

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

  markAlive() {
    $apiReady.set(true)
    $disconnected.set(false)

    clearTimeout(this.disconnectTimer)
    this.disconnectTimer = undefined
  }

  reconnectSoon(reason?: string, delay = 5000, flags?: {shutup?: boolean}) {
    if (!this.sock) return

    $apiReady.set(false)

    // stop listening to inference events
    if (flags?.shutup) {
      this.removeListeners()
    }

    setTimeout(() => {
      console.log(`[ws] reconnecting due to "${reason}"`)

      this.sock = this.createWs()
    }, delay)
  }

  close() {
    this.sock.close()
    this.markDisconnect()
  }
}

export const socket = new SocketManager()
