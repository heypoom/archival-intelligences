import {$disconnected, $exhibitionMode} from '../store/exhibition'
import {
  $progress,
  $startTimestep,
  $timestep,
  resetProgress,
} from '../store/progress'
import {
  $apiReady,
  $generating,
  $inferencePreview,
  $booting,
} from '../store/prompt'

/** After 8 seconds of no activity, consider the connection dead */
const DISCONNECT_TIMEOUT = 8 * 1000

/** After 15 seconds of no activity, consider the generation to be stuck */
const RECONNECT_DELAY = 5000 // 5 seconds
const STUCK_RECONNECT_DELAY = 500 // 0.5 seconds

export type ProgramId = 'P0' | 'P2' | 'P2B' | 'P3' | 'P3B' | 'P4'
export type EndpointType = 'textToImage'

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
  textToImage: 'wss://noop',
  // imageToImage: 'wss://heypoom--exhibition-text-to-image-endpoint.modal.run/ws',
} as const satisfies Record<EndpointType, string>

const PROGRAM_ENDPOINT_MAP: Record<ProgramId, EndpointType> = {
  P0: 'textToImage',
  P2: 'textToImage',
  P2B: 'textToImage',
  P3: 'textToImage',
  P3B: 'textToImage',
  P4: 'textToImage',
}

interface EndpointState {
  socket: WebSocket
  disconnectTimer?: number
  generationStuckTimer?: number
  currentInferenceMessage?: string
  programs: Set<ProgramId>
}

interface ReconnectOptions {
  reason?: string
  delay?: number
  removeListener?: boolean
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

  private createEndpoint(_endpointType: EndpointType) {
    _endpointType
    // const url = ENDPOINT_URL_MAP[endpointType]
    // const socket = new WebSocket(url)
    // const state: EndpointState = {
    //   socket,
    //   disconnectTimer: undefined,
    //   generationStuckTimer: undefined,
    //   currentInferenceMessage: undefined,
    //   programs: new Set(),
    // }
    // console.log(`[ws] created endpoint "${endpointType}" using url "${url}"`)
    // this.endpoints.set(endpointType, state)
    // this.addListeners(endpointType)
    // this.startDisconnectionTimer(endpointType)
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

    if (state.socket) {
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

    this.reconnectSoon(endpointType, {
      reason: 'generation is stuck',
      delay: STUCK_RECONNECT_DELAY,
      removeListener: true,
    })
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

    state.socket.addEventListener('error', (event) =>
      this.onError(endpointType, event)
    )
    state.socket.addEventListener('open', () => this.onOpen(endpointType))
    state.socket.addEventListener('close', () => this.onClose(endpointType))
    state.socket.addEventListener('message', (event) =>
      this.onMessage(endpointType, event)
    )
  }

  removeListeners(endpointType: EndpointType) {
    const state = this.getEndpointState(endpointType)
    if (!state) return

    state.socket.removeEventListener('error', (event) =>
      this.onError(endpointType, event)
    )
    state.socket.removeEventListener('open', () => this.onOpen(endpointType))
    state.socket.removeEventListener('close', () => this.onClose(endpointType))
    state.socket.removeEventListener('message', (event) =>
      this.onMessage(endpointType, event)
    )
  }

  onError(endpointType: EndpointType, event: Event) {
    console.error(`[ws] websocket error for ${endpointType}`, event)

    this.markDisconnect(endpointType)
    this.reconnectSoon(endpointType, {reason: 'websocket error'})
  }

  onOpen(endpointType: EndpointType) {
    console.log(`[ws] websocket connected to "${endpointType}"`)
    this.markAlive(endpointType)

    // ping the server once to check if it's ready
    this.ping(endpointType)
  }

  generate(programId: ProgramId, message: string) {
    const endpointType = this.getEndpointType(programId)
    const state = this.getEndpointState(endpointType)
    if (!state) return

    // Format the message with program ID prefix
    const formattedMessage =
      programId === 'P0' ? message : `${programId}:${message}`

    console.log(`[gen] sent "${formattedMessage}" to ${programId}`)

    state.socket.send(formattedMessage)
    this.startGenerationStuckTimer(endpointType, formattedMessage)
  }

  onClose(endpointType: EndpointType) {
    console.log(`[ws] websocket closed for ${endpointType}`)

    this.markDisconnect(endpointType)
    this.reconnectSoon(endpointType, {reason: 'websocket closed'})
  }

  onMessage(endpointType: EndpointType, event: MessageEvent) {
    this.markAlive(endpointType)

    const data = event.data

    // Handle ping/pong messages
    if (typeof data === 'string' && data === 'pong') {
      $booting.set(false)
      return
    }

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

  reconnectSoon(endpointType: EndpointType, options: ReconnectOptions = {}) {
    const state = this.getEndpointState(endpointType)
    if (!state) return

    $apiReady.set(false)

    // stop listening to inference events
    if (options.removeListener) {
      this.removeListeners(endpointType)
    }

    setTimeout(() => {
      console.log(
        `[ws] reconnecting ${endpointType} due to "${options.reason}"`
      )

      this.createEndpoint(endpointType)
    }, options.delay ?? RECONNECT_DELAY)
  }

  close() {
    this.endpoints.forEach((state, endpointType) => {
      state.socket.close()
      this.markDisconnect(endpointType)
    })
  }

  forceReconnectAll(reason = 'force reconnect to server') {
    this.endpoints.forEach((_, endpointType) => {
      this.reconnectSoon(endpointType, {reason, delay: 10})
    })
  }

  disconnectAll() {
    // close all the sockets
    this.endpoints.forEach((state, endpointType) => {
      this.markDisconnect(endpointType)
      this.clearDisconnectionTimer(endpointType)
      state.socket.close()
    })
  }

  ping(endpointType: EndpointType) {
    const state = this.getEndpointState(endpointType)
    if (!state) return

    $booting.set(true)
    state.socket.send('ping')
  }
}

export const socket = new SocketManager()
