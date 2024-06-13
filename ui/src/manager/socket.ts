import {$apiReady, $generating, $inferencePreview} from '../store/prompt.ts'

type SystemEvent =
  | {type: 'start'}
  | {type: 'sending'}
  | {type: 'image'; blob: Blob; url: string}
  | {type: 'done'}

type Handler = (event: SystemEvent) => void

// ruian-sg-api.poom.dev
const REMOTE_WS_URL = 'ws://35.247.139.252:8000/ws'

class SocketManager {
  sock: WebSocket
  ready = false
  url = REMOTE_WS_URL
  speech = false

  handlers: Handler[] = []

  constructor() {
    this.sock = new WebSocket(this.url)

    console.log(`connection target: ${this.url}`)

    this.sock.addEventListener('error', (event) => {
      console.error('$ websocket error', event)
    })

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

    this.sock.addEventListener('message', (event) => {
      const data = event.data

      // binary data received - assume JPEG-encoded image
      if (data instanceof Blob) {
        const blob = new Blob([data], {type: 'image/jpeg'})
        const url = URL.createObjectURL(blob)

        $inferencePreview.set(url)

        this.dispatch({type: 'image', blob, url})
      }

      if (typeof data === 'string') {
        const cmd = data.trim()

        if (cmd === 'ready') this.dispatch({type: 'start'})

        if (cmd === 'sending') {
          $generating.set(false)
          console.log('sending received')

          // if (this.speech) {
          //   // dictation.stop()
          //   // dictation.start()
          // }
        }

        if (cmd === 'done') {
          this.dispatch({type: 'done'})
          $generating.set(false)
        }
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
