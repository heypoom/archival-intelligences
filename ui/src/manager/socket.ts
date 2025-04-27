import {$disconnected, $exhibitionMode} from '../store/exhibition'
import {
  $progress,
  $startTimestep,
  $timestep,
  resetProgress,
} from '../store/progress'
import {$apiReady, $generating, $inferencePreview} from '../store/prompt'

/** After 8 seconds of no activity, consider the connection dead */
const DISCONNECT_TIMEOUT = 8 * 1000

export type ProgramId = 'P0' | 'P2' | 'P2B' | 'P3' | 'P3B' | 'P4'

/** After 15 seconds of no activity, consider the generation to be stuck */
const generationTimeouts: Record<ProgramId, number> = {
  // more timeout when there is no denoising
  P0: 30 * 1000,
  P2: 20 * 1000,
  P2B: 20 * 1000,
  P3: 20 * 1000,
  P3B: 20 * 1000,
  P4: 20 * 1000,
}

const ENDPOINT_MAPS = {
  simple: 'wss://heypoom--exhibition-image-simple-endpoint.modal.run/ws',
  withNoise:
    'wss://heypoom--exhibition-with-realtime-noise-endpoint.modal.run/ws',
} as const satisfies Record<string, string>

const SOCKET_URL_MAPS: Record<ProgramId, string> = {
  P0: ENDPOINT_MAPS.simple,
  P2: ENDPOINT_MAPS.withNoise,
  P2B: ENDPOINT_MAPS.withNoise,
  P3: ENDPOINT_MAPS.withNoise,
  P3B: ENDPOINT_MAPS.withNoise,
  P4: ENDPOINT_MAPS.withNoise,
}

interface EndpointState {
  sock: WebSocket
  disconnectTimer?: number
  generationStuckTimer?: number
  currentInferenceMessage?: string
}

class SocketManager {
  private endpoints: Map<ProgramId, EndpointState>

  constructor() {
    this.endpoints = new Map()
    this.initializeEndpoints()
  }

  private initializeEndpoints() {
    Object.keys(SOCKET_URL_MAPS).forEach((programId) => {
      const key = programId as ProgramId
      this.createEndpoint(key)
    })
  }

  private createEndpoint(programId: ProgramId) {
    const url = SOCKET_URL_MAPS[programId]
    const ws = new WebSocket(url)

    const state: EndpointState = {
      sock: ws,
      disconnectTimer: undefined,
      generationStuckTimer: undefined,
      currentInferenceMessage: undefined,
    }

    this.endpoints.set(programId, state)
    this.addListeners(programId)
    this.startDisconnectionTimer(programId)
  }

  private getEndpointState(programId: ProgramId): EndpointState | undefined {
    return this.endpoints.get(programId)
  }

  markDisconnect(programId: ProgramId) {
    const state = this.getEndpointState(programId)
    if (!state) return

    if (state.sock) {
      this.removeListeners(programId)
    }

    $apiReady.set(false)
    $generating.set(false)
    resetProgress()

    this.clearGenerationStuckTimer(programId)
    this.startDisconnectionTimer(programId)
  }

  isExhibition() {
    return $exhibitionMode.get()
  }

  startDisconnectionTimer(programId: ProgramId) {
    const state = this.getEndpointState(programId)
    if (!state) return

    if (state.disconnectTimer === undefined) {
      state.disconnectTimer = setTimeout(() => {
        // connection is dead
        console.log(`[ws] websocket connection dead for ${programId}`)
        $disconnected.set(true)
      }, DISCONNECT_TIMEOUT)
    }
  }

  isInProgress() {
    const progress = $progress.get()
    const isInProgress = progress > 0 && progress < 98

    return isInProgress
  }

  startGenerationStuckTimer(programId: ProgramId, inferenceMessage?: string) {
    const state = this.getEndpointState(programId)
    if (!state) return

    // enable only when in exhibition, not in lecture
    if (!this.isExhibition()) return

    const message = inferenceMessage ?? state.currentInferenceMessage

    if (inferenceMessage) {
      state.currentInferenceMessage = inferenceMessage
    }

    if (state.generationStuckTimer !== undefined) {
      this.clearGenerationStuckTimer(programId)
    }

    // skip if the timeout is not defined
    const stuckTimeout = generationTimeouts[programId]
    if (!stuckTimeout || stuckTimeout <= 0) return

    console.log(`[watchdog] "${programId}" :: ${stuckTimeout}ms`)

    state.generationStuckTimer = setTimeout(() => {
      console.log(`[watchdog] "${message}" is stuck!`)

      this.handleGenerationStuck(programId)
    }, stuckTimeout)
  }

  handleGenerationStuck(programId: ProgramId) {
    $generating.set(false)
    $inferencePreview.set('')
    resetProgress()

    this.reconnectSoon(programId, 'generation is stuck', 500, {shutup: true})
  }

  clearDisconnectionTimer(programId: ProgramId) {
    const state = this.getEndpointState(programId)
    if (!state) return

    clearTimeout(state.disconnectTimer)
    state.disconnectTimer = undefined
  }

  clearGenerationStuckTimer(programId: ProgramId) {
    const state = this.getEndpointState(programId)
    if (!state) return

    clearTimeout(state.generationStuckTimer)
    state.generationStuckTimer = undefined
  }

  addListeners(programId: ProgramId) {
    const state = this.getEndpointState(programId)
    if (!state) return

    state.sock.addEventListener('error', (event) =>
      this.onError(programId, event)
    )
    state.sock.addEventListener('open', () => this.onOpen(programId))
    state.sock.addEventListener('close', () => this.onClose(programId))
    state.sock.addEventListener('message', (event) =>
      this.onMessage(programId, event)
    )
  }

  removeListeners(programId: ProgramId) {
    const state = this.getEndpointState(programId)
    if (!state) return

    state.sock.removeEventListener('error', (event) =>
      this.onError(programId, event)
    )
    state.sock.removeEventListener('open', () => this.onOpen(programId))
    state.sock.removeEventListener('close', () => this.onClose(programId))
    state.sock.removeEventListener('message', (event) =>
      this.onMessage(programId, event)
    )
  }

  onError(programId: ProgramId, event: Event) {
    console.error(`[ws] websocket error for ${programId}`, event)

    this.markDisconnect(programId)
    this.reconnectSoon(programId, 'websocket error')
  }

  onOpen(programId: ProgramId) {
    console.log(`[ws] websocket connected to "${programId}"`)
    this.markAlive(programId)
  }

  generate(programKey: ProgramId, message: string) {
    const state = this.getEndpointState(programKey)
    if (!state) return

    console.log(`[gen] sent "${message}" to ${programKey}`)

    state.sock.send(message)
    this.startGenerationStuckTimer(programKey, message)
  }

  onClose(programId: ProgramId) {
    console.log(`[ws] websocket closed for ${programId}`)

    this.markDisconnect(programId)
    this.reconnectSoon(programId, 'websocket closed', 5000)
  }

  onMessage(programId: ProgramId, event: MessageEvent) {
    this.markAlive(programId)

    const data = event.data

    // binary data received - assume JPEG-encoded image
    if (data instanceof Blob) {
      const blob = new Blob([data], {type: 'image/jpeg'})
      const url = URL.createObjectURL(blob)

      $inferencePreview.set(url)

      this.startGenerationStuckTimer(programId)
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

        if (this.isInProgress()) {
          // continue to monitor the generation
          this.startGenerationStuckTimer(programId)
        } else {
          this.clearGenerationStuckTimer(programId)
        }
      } else if (res === 'done') {
        // generation is done, stop monitoring the generation
        this.clearGenerationStuckTimer(programId)

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

  markAlive(programId: ProgramId) {
    $apiReady.set(true)
    $disconnected.set(false)

    this.clearDisconnectionTimer(programId)
  }

  reconnectSoon(
    programId: ProgramId,
    reason?: string,
    delay = 5000,
    flags?: {shutup?: boolean}
  ) {
    const state = this.getEndpointState(programId)
    if (!state) return

    $apiReady.set(false)

    // stop listening to inference events
    if (flags?.shutup) {
      this.removeListeners(programId)
    }

    setTimeout(() => {
      console.log(`[ws] reconnecting ${programId} due to "${reason}"`)

      this.createEndpoint(programId)
    }, delay)
  }

  close() {
    this.endpoints.forEach((state, programId) => {
      state.sock.close()
      this.markDisconnect(programId)
    })
  }

  forceReconnectAll(reason = 'force reconnect to server') {
    this.endpoints.forEach((_, programId) => {
      this.reconnectSoon(programId, reason, 10)
    })
  }

  disconnectAll() {
    // close all the sockets
    this.endpoints.forEach((state, programId) => {
      this.markDisconnect(programId)
      this.clearDisconnectionTimer(programId)
      state.sock.close()
    })
  }
}

export const socket = new SocketManager()
