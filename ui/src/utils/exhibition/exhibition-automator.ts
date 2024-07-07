import dayjs, {Dayjs} from 'dayjs'
import {nanoid} from 'nanoid'
import {AutomationCue, PART_TWO_CUES} from '../../constants/exhibition-cues'
import {loadTranscriptCue} from './cue-from-transcript'
import {getCurrentCue} from './get-current-cue'
import {AutomatorContext, runAutomationAction} from './run-automation-action'

import {secOf, timecodeOf, hhmmOf, hhmmssOf} from './timecode'

import {$exhibitionMode, $exhibitionStatus} from '../../store/exhibition'
import {getExhibitionStatus} from './get-exhibition-status'
import {match} from 'ts-pattern'
import {routeFromCue} from './route-from-cue'
import {$ipcMode, IpcMessage} from '../../store/window-ipc'

export class ExhibitionAutomator {
  timer: number | null = null

  cues: AutomationCue[] = []
  currentCue = -1

  private startTime: Dayjs | null = null

  ipc = new BroadcastChannel('exhibition-ipc')
  ipcId = nanoid()

  videoRef: HTMLVideoElement | null = null

  // allows emulation of time
  now = () => new Date()

  actionContext: AutomatorContext = {
    navigate: () => {},
    next: () => {},
    cue: () => this.currentCue,
    elapsed: () => this.elapsed,
  }

  constructor() {
    if (typeof window !== 'undefined') {
      // @ts-expect-error - make it available for debugging
      window.automator = this
    }
  }

  async setup() {
    this.ipc.addEventListener('message', this.onIpcMessage)

    this.sendIpcMessage({type: 'ping', id: this.ipcId})

    await this.load()
  }

  initVideo(v: HTMLVideoElement) {
    this.videoRef = v
    v.currentTime = this.elapsed
  }

  onIpcMessage = (event: MessageEvent<IpcMessage>) => {
    console.log(`[ipc] message received:`, event.data)
    const id = this.ipcId
    const mode = $ipcMode.get()

    if (!event.data) return

    match(event.data)
      .with({type: 'ping'}, () => {
        this.sendIpcMessage({type: 'pong', id, mode, elapsed: this.elapsed})
      })
      .with({type: 'pong'}, (msg) => {
        // if there are already a window in program mode, switch to video mode
        if (msg.mode !== 'program') return

        $ipcMode.set('video')
        this.actionContext.navigate('/video')

        setTimeout(() => {
          if (this.videoRef) {
            this.videoRef.currentTime = msg.elapsed
            this.videoRef.play()
          }
        }, 1000)

        this.sync({force: true})
      })
      .with({type: 'play'}, (msg) => {
        if (mode !== 'video' || !this.videoRef) return

        this.actionContext.navigate('/video')

        this.videoRef.currentTime = msg.elapsed
        this.videoRef.play()
      })
      .exhaustive()
  }

  sendIpcMessage(message: IpcMessage) {
    this.ipc.postMessage(message)
  }

  startClock() {
    if (this.timer) {
      this.stopClock()
    }

    this.tick()

    this.timer = setInterval(() => {
      this.tick()
    }, 1000)
  }

  stopClock() {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null

    console.log(`> clock stopped`)
  }

  load = async () => {
    const transcriptCues = await loadTranscriptCue()

    this.cues = [
      {time: '00:00:00', action: 'start'},
      ...transcriptCues,
      ...PART_TWO_CUES,
    ]
  }

  tick() {
    if (this.canGo()) this.go()
  }

  go() {
    this.currentCue++

    const action = this.cues[this.currentCue]
    console.log(`running action cue ${this.currentCue}:`, action)

    this.actionContext.cue = () => this.currentCue
    this.actionContext.elapsed = () => this.elapsed

    if (action.action === 'start') {
      this.sendIpcMessage({type: 'play', elapsed: this.elapsed})
    }

    runAutomationAction(action, this.actionContext)
  }

  canGo(): boolean {
    const nextCue = this.cues[this.currentCue + 1]
    if (!nextCue) return false

    const nextCueTime = secOf(nextCue.time)

    return this.elapsed >= nextCueTime
  }

  seekCue(time: string) {
    const seq = getCurrentCue(time, this.cues)
    if (!seq) {
      console.log('no cue found for', time)
      return
    }

    const [cue] = seq

    console.log(`seeking to cue ${cue} | t=${time}`)
    this.currentCue = cue
  }

  get elapsed(): number {
    if (this.startTime === null) return -1

    return dayjs(this.now()).diff(this.startTime, 'seconds')
  }

  /** Mock the time source. */
  mockTime(time: string, dynamic = true) {
    const origin = hhmmssOf(time)

    if (!dynamic) {
      this.now = () => origin
      return
    }

    const start = new Date()

    // Simulates passage of time
    this.now = () => {
      const elapsed = dayjs().diff(start, 'seconds')

      return dayjs(origin).add(elapsed, 'seconds').toDate()
    }
  }

  sync(options: {force?: boolean} = {}) {
    const {force = false} = options

    // only activate when in exhibition mode
    const isExhibition = $exhibitionMode.get()
    if (!isExhibition) return

    const {navigate: go} = this.actionContext

    const prev = $exhibitionStatus.get()
    const next = getExhibitionStatus(this.now())
    $exhibitionStatus.set(next)

    if (!force && JSON.stringify(prev) === JSON.stringify(next)) return

    if (next && next.type === 'active') {
      this.startTime = dayjs(hhmmOf(next.start))
    }

    const isVideo = $ipcMode.get() === 'video'
    if (isVideo) {
      go('/video')

      return
    }

    console.log(`> exhibition status changed:`, next)

    if (next.type !== 'active') {
      this.stopClock()
      this.startTime = null
    } else {
      this.seekCue(timecodeOf(this.elapsed))

      if (automator.timer === null) automator.startClock()

      this.sendIpcMessage({type: 'play', elapsed: this.elapsed})
    }

    match(next.type)
      .with('loading', () => {
        // do nothing
      })
      .with('wait', () => {
        go('/waiting')
      })
      .with('closed', () => {
        go('/closed')
      })
      .with('active', () => {
        this.restoreRouteFromCue()
      })
      .exhaustive()

    return {prev, next}
  }

  restoreRouteFromCue() {
    const route = routeFromCue(this.currentCue, this.cues)

    this.actionContext.navigate(route)
  }
}

export const automator = new ExhibitionAutomator()
automator.setup()
