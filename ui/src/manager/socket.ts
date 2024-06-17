import {$startTimestep, $timestep} from '../store/progress.ts'
import {$apiReady, $generating, $inferencePreview} from '../store/prompt.ts'

// ruian-sg-api.poom.dev
const REMOTE_WS_URL = 'ws://35.247.139.252:8000/ws'

class SocketManager {
  sock: WebSocket
  url = REMOTE_WS_URL
  reconnecting = false

  constructor() {
    this.sock = new WebSocket(this.url)
    this.configureWs()
  }

  markDisconnect() {
    $apiReady.set(false)
    $generating.set(false)
  }

  configureWs() {
    this.sock.addEventListener('error', (event) => {
      console.error('$ websocket error', event)

      this.markDisconnect()
      this.reconnectSoon('websocket error')
    })

    this.sock.addEventListener('open', () => {
      console.log(`$ websocket connected to "${this.sock.url}"`)

      this.reconnecting = false
      $apiReady.set(true)
    })

    this.sock.addEventListener('close', () => {
      console.log('$ websocket closed')

      this.markDisconnect()
      this.reconnectSoon('websocket closed', 5000)
    })

    this.sock.addEventListener('message', (event) => {
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

            console.log(`[ws] s=${s}, t=${t}`)

            $timestep.set(t)

            if (s === 0) {
              $startTimestep.set(t)
            }
          }
        } else if (res === 'done') {
          $generating.set(false)
          console.log(`[ws] done!`)
        } else {
          console.log(`[ws] text: "${res.substring(0, 200)}"`)
        }
      } else {
        console.log(`[ws] unknown:`, event)
      }
    })
  }

  reconnectSoon(reason?: string, delay = 5000) {
    if (this.reconnecting) return
    if (!this.sock) return

    $apiReady.set(false)
    this.reconnecting = true

    // retry connection after 5 seconds
    setTimeout(() => {
      console.log(`$ reconnecting due to "${reason}"`)

      this.sock = new WebSocket(this.url)

      this.configureWs()
    }, delay)
  }

  close() {
    this.sock.close()
    this.markDisconnect()
  }
}

export const socket = new SocketManager()
