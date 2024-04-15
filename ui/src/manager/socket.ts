import { $apiReady, $inferencePreview } from '../store/prompt.ts'

type SystemEvent =
  | { type: 'start' }
  | { type: 'image'; blob: Blob; url: string }
  | { type: 'done' }

type Handler = (event: SystemEvent) => void

const LOCAL_WS_URL = 'ws://localhost:8000/ws'
const DEV_WS_URL = 'ws://209.51.170.72:8000/ws'

class SocketManager {
  sock: WebSocket
  ready = false
  url = DEV_WS_URL

  handlers: Handler[] = []

  constructor() {
    this.sock = new WebSocket(this.url)

    this.sock.addEventListener('open', () => {
      this.ready = true
      $apiReady.set(true)
      console.log(`$ websocket connected to "${this.sock.url}"`)
    })

    this.sock.addEventListener('close', () => {
      this.ready = false
      $apiReady.set(false)
      console.log('$ websocket closed')
    })

    this.sock.addEventListener('message', event => {
      const data = event.data

      // binary data received - assume JPEG-encoded image
      if (data instanceof Blob) {
        const blob = new Blob([data], { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)

        $inferencePreview.set(url)

        this.dispatch({ type: 'image', blob, url })
      }

      if (typeof data === 'string') {
        const cmd = data.trim()

        if (cmd === 'ready') this.dispatch({ type: 'start' })
        if (cmd === 'done') this.dispatch({ type: 'done' })
      }
    })
  }

  dispatch(event: SystemEvent) {
    for (const handler of this.handlers) {
      handler(event)
    }
  }

  close() {
    this.sock.close()
  }
}

export const socket = new SocketManager()
