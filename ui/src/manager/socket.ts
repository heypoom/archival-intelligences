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
export type EndpointType = 'simple' | 'withNoise'

/** After 15 seconds of no activity, consider the generation to be stuck */
const GENERATION_TIMEOUT_MAP: Record<ProgramId, number> = {
  // more timeout when there is no denoising
  P0: 30 * 1000,
  P2: 20 * 1000,
  P2B: 20 * 1000,
  P3: 20 * 1000,
  P3B: 20 * 1000,
  P4: 20 * 1000,
}

const ENDPOINT_URL_MAP = {
  simple: 'wss://heypoom--exhibition-image-simple-endpoint.modal.run/ws',
  withNoise:
    'wss://heypoom--exhibition-with-realtime-noise-endpoint.modal.run/ws',
} as const satisfies Record<EndpointType, string>

const PROGRAM_ENDPOINT_MAP: Record<ProgramId, EndpointType> = {
  P0: 'simple',
  P2: 'withNoise',
  P2B: 'withNoise',
  P3: 'withNoise',
  P3B: 'withNoise',
  P4: 'withNoise',
}

interface EndpointState {
  sock: WebSocket
  disconnectTimer?: number
  generationStuckTimer?: number
  currentInferenceMessage?: string
  programs: Set<ProgramId>
}

class SocketManager {
  private endpoints: Map<EndpointType, EndpointState>

  constructor() {
    this.endpoints = new Map()
    this.initializeEndpoints()
  }

  private initializeEndpoints() {
    Object.values(ENDPOINT_URL_MAP).forEach((url) => {
      const endpointType = Object.entries(ENDPOINT_URL_MAP).find(
        ([, value]) => value === url
      )?.[0] as EndpointType

      if (endpointType) {
        this.createEndpoint(endpointType)
      }
    })
  }

  private createEndpoint(endpointType: EndpointType) {
    const url = ENDPOINT_URL_MAP[endpointType]
    const ws = new WebSocket(url)

    const state: EndpointState = {
      sock: ws,
      disconnectTimer: undefined,
      generationStuckTimer: undefined,
      currentInferenceMessage: undefined,
      programs: new Set(),
    }

    this.endpoints.set(endpointType, state)
    this.addListeners(endpointType)
    this.startDisconnectionTimer(endpointType)
  }

  private getEndpointState(
    endpointType: EndpointType
  ): EndpointState | undefined {
    return this.endpoints.get(endpointType)
  }

  private getEndpointType(programId: ProgramId): EndpointType {
    return PROGRAM_ENDPOINT_MAP[programId]
  }

  markDisconnect(endpointType: EndpointType) {
    const state = this.getEndpointState(endpointType)
    if (!state) return

    if (state.sock) {
      this.removeListeners(endpointType)
    }

    $apiReady.set(false)
    $generating.set(false)
    resetProgress()

    this.clearGenerationStuckTimer(endpointType)
    this.startDisconnectionTimer(endpointType)
  }

  isExhibition() {
    return $exhibitionMode.get()
  }

  startDisconnectionTimer(endpointType: EndpointType) {
    const state = this.getEndpointState(endpointType)
    if (!state) return

    if (state.disconnectTimer === undefined) {
      state.disconnectTimer = setTimeout(() => {
        // connection is dead
        console.log(`[ws] websocket connection dead for ${endpointType}`)
        $disconnected.set(true)
      }, DISCONNECT_TIMEOUT)
    }
  }

  isInProgress() {
    const progress = $progress.get()
    const isInProgress = progress > 0 && progress < 98

    return isInProgress
  }

  startGenerationStuckTimer(
    endpointType: EndpointType,
    inferenceMessage?: string
  ) {
    const state = this.getEndpointState(endpointType)
    if (!state) return

    // enable only when in exhibition, not in lecture
    if (!this.isExhibition()) return

    const message = inferenceMessage ?? state.currentInferenceMessage

    if (inferenceMessage) {
      state.currentInferenceMessage = inferenceMessage
    }

    if (state.generationStuckTimer !== undefined) {
      this.clearGenerationStuckTimer(endpointType)
    }

    // skip if the timeout is not defined
    const stuckTimeout = Math.max(
      ...Array.from(state.programs).map(
        (programId: ProgramId) => GENERATION_TIMEOUT_MAP[programId]
      )
    )
    if (!stuckTimeout || stuckTimeout <= 0) return

    console.log(`[watchdog] "${endpointType}" :: ${stuckTimeout}ms`)

    state.generationStuckTimer = setTimeout(() => {
      console.log(`[watchdog] "${message}" is stuck!`)

      this.handleGenerationStuck(endpointType)
    }, stuckTimeout)
  }

  handleGenerationStuck(endpointType: EndpointType) {
    $generating.set(false)
    $inferencePreview.set('')
    resetProgress()

    this.reconnectSoon(endpointType, 'generation is stuck', 500, {shutup: true})
  }

  clearDisconnectionTimer(endpointType: EndpointType) {
    const state = this.getEndpointState(endpointType)
    if (!state) return

    clearTimeout(state.disconnectTimer)
    state.disconnectTimer = undefined
  }

  clearGenerationStuckTimer(endpointType: EndpointType) {
    const state = this.getEndpointState(endpointType)
    if (!state) return

    clearTimeout(state.generationStuckTimer)
    state.generationStuckTimer = undefined
  }

  addListeners(endpointType: EndpointType) {
    const state = this.getEndpointState(endpointType)
    if (!state) return

    state.sock.addEventListener('error', (event) =>
      this.onError(endpointType, event)
    )
    state.sock.addEventListener('open', () => this.onOpen(endpointType))
    state.sock.addEventListener('close', () => this.onClose(endpointType))
    state.sock.addEventListener('message', (event) =>
      this.onMessage(endpointType, event)
    )
  }

  removeListeners(endpointType: EndpointType) {
    const state = this.getEndpointState(endpointType)
    if (!state) return

    state.sock.removeEventListener('error', (event) =>
      this.onError(endpointType, event)
    )
    state.sock.removeEventListener('open', () => this.onOpen(endpointType))
    state.sock.removeEventListener('close', () => this.onClose(endpointType))
    state.sock.removeEventListener('message', (event) =>
      this.onMessage(endpointType, event)
    )
  }

  onError(endpointType: EndpointType, event: Event) {
    console.error(`[ws] websocket error for ${endpointType}`, event)

    this.markDisconnect(endpointType)
    this.reconnectSoon(endpointType, 'websocket error')
  }

  onOpen(endpointType: EndpointType) {
    console.log(`[ws] websocket connected to "${endpointType}"`)
    this.markAlive(endpointType)
  }

  generate(programId: ProgramId, message: string) {
    const endpointType = this.getEndpointType(programId)
    const state = this.getEndpointState(endpointType)
    if (!state) return

    console.log(`[gen] sent "${message}" to ${programId}`)

    state.sock.send(message)
    this.startGenerationStuckTimer(endpointType, message)
  }

  onClose(endpointType: EndpointType) {
    console.log(`[ws] websocket closed for ${endpointType}`)

    this.markDisconnect(endpointType)
    this.reconnectSoon(endpointType, 'websocket closed', 5000)
  }

  onMessage(endpointType: EndpointType, event: MessageEvent) {
    this.markAlive(endpointType)

    const data = event.data

    // binary data received - assume JPEG-encoded image
    if (data instanceof Blob) {
      const blob = new Blob([data], {type: 'image/jpeg'})
      const url = URL.createObjectURL(blob)

      $inferencePreview.set(url)

      this.startGenerationStuckTimer(endpointType)
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
          this.startGenerationStuckTimer(endpointType)
        } else {
          this.clearGenerationStuckTimer(endpointType)
        }
      } else if (res === 'done') {
        // generation is done, stop monitoring the generation
        this.clearGenerationStuckTimer(endpointType)

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

  markAlive(endpointType: EndpointType) {
    $apiReady.set(true)
    $disconnected.set(false)

    this.clearDisconnectionTimer(endpointType)
  }

  reconnectSoon(
    endpointType: EndpointType,
    reason?: string,
    delay = 5000,
    flags?: {shutup?: boolean}
  ) {
    const state = this.getEndpointState(endpointType)
    if (!state) return

    $apiReady.set(false)

    // stop listening to inference events
    if (flags?.shutup) {
      this.removeListeners(endpointType)
    }

    setTimeout(() => {
      console.log(`[ws] reconnecting ${endpointType} due to "${reason}"`)

      this.createEndpoint(endpointType)
    }, delay)
  }

  close() {
    this.endpoints.forEach((state, endpointType) => {
      state.sock.close()
      this.markDisconnect(endpointType)
    })
  }

  forceReconnectAll(reason = 'force reconnect to server') {
    this.endpoints.forEach((_, endpointType) => {
      this.reconnectSoon(endpointType, reason, 10)
    })
  }

  disconnectAll() {
    // close all the sockets
    this.endpoints.forEach((state, endpointType) => {
      this.markDisconnect(endpointType)
      this.clearDisconnectionTimer(endpointType)
      state.sock.close()
    })
  }
}

export const socket = new SocketManager()
