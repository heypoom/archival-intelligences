import dayjs, {Dayjs} from 'dayjs'
import {nanoid} from 'nanoid'
import {AutomationCue, PART_TWO_CUES} from '../../constants/exhibition-cues'
import {loadTranscriptCue} from './cue-from-transcript'
import {getCurrentCue} from './get-current-cue'
import {AutomatorContext, runAutomationAction} from './run-automation-action'

import {secOf, timecodeOf, hhmmOf, hhmmssOf} from './timecode'

import {
  $disconnected,
  $exhibitionMode,
  $exhibitionStatus,
  $canPlay,
} from '../../store/exhibition'
import {getExhibitionStatus} from './get-exhibition-status'
import {match} from 'ts-pattern'
import {routeFromCue} from './route-from-cue'
import {$ipcMode, IpcAction, IpcMessage, IpcMeta} from '../../store/window-ipc'
import {ExhibitionStatus} from '../../types/exhibition-status'

export class ExhibitionAutomator {
  timer: number | null = null

  cues: AutomationCue[] = []
  currentCue = -1

  private startTime: Dayjs | null = null

  ipc = new BroadcastChannel('exhibition-ipc')
  ipcId = nanoid()

  videoRef: HTMLVideoElement | null = null

  // for emergency fallback video, when the GPU server crashes.
  fallbackVideoRef: HTMLVideoElement | null = null

  // allows emulation of time
  now = () => new Date()

  dynamicMockedTime: string | null = null

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

    // send the ping message to discover other windows
    this.sendIpcAction({type: 'ping'})

    await this.load()
  }

  initVideo(video: HTMLVideoElement) {
    this.videoRef = video
  }

  initFallbackVideo(video: HTMLVideoElement) {
    this.fallbackVideoRef = video

    const shouldPlayFallbackVideo =
      $exhibitionMode.get() &&
      $exhibitionStatus.get().type === 'active' &&
      $ipcMode.get() !== 'video' &&
      $disconnected.get()

    if (shouldPlayFallbackVideo) {
      console.log('[init fallback video]', shouldPlayFallbackVideo)
      this.playFallbackVideo()
    }
  }

  onIpcMessage = (event: MessageEvent<IpcMessage>) => {
    const mode = $ipcMode.get()

    if (!event.data) return

    match(event.data)
      .with({type: 'ping'}, () => {
        this.sendIpcAction({type: 'pong', mode, elapsed: this.elapsed})
      })
      .with({type: 'pong'}, (msg) => {
        // if there are already a window in program mode, switch to video mode.
        if (msg.mode === 'program') {
          this.syncIpcTime(msg)
          $ipcMode.set('video')
          this.sync({force: true})

          console.log(`[ipc] we switch ourselves to video mode`, msg)
        }
      })
      .with({type: 'play'}, (msg) => {
        if (mode !== 'video' || !this.videoRef) return

        this.syncIpcTime(msg)
        this.sync({force: true})
        this.playVideo(msg.elapsed)

        console.log(`[ipc] we play the video`, msg)
      })
      .exhaustive()
  }

  async playVideo(elapsed: number = this.elapsed) {
    if ($ipcMode.get() !== 'video') return

    this.actionContext.navigate('/video')

    // if the video element is not ready, do nothing
    if (!this.videoRef) return

    // if the video is already playing at the same time, do nothing
    if (isVideoPlaying(this.videoRef) && this.videoRef.currentTime === elapsed)
      return

    // this means that the video is not ready yet, as it does not have a configured start time
    if (elapsed === -1) return

    console.log(`[play video] at ${elapsed} seconds`)

    try {
      this.videoRef.currentTime = elapsed

      await this.videoRef.play()
    } catch (err) {
      console.log(`[cannot play video]`, err)

      // something is wrong with the auto-play policy
      $canPlay.set(false)
    }
  }

  sendIpcAction(action: IpcAction) {
    const meta: IpcMeta = {
      ipcId: this.ipcId,
      dynamicMockedTime: this.dynamicMockedTime,
    }

    const message: IpcMessage = {...action, ...meta}

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
      this.sendIpcAction({type: 'play', elapsed: this.elapsed})
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
    // this means that the video is not ready yet, as it does not have a configured start time
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

    this.dynamicMockedTime = time

    const start = new Date()

    // Simulates passage of time
    this.now = () => {
      const elapsed = dayjs().diff(start, 'seconds')

      return dayjs(origin).add(elapsed, 'seconds').toDate()
    }
  }

  configureStartTime(startAt: string) {
    this.startTime = dayjs(hhmmOf(startAt))
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

    this.configureStartTime(next)

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

      this.sendIpcAction({type: 'play', elapsed: this.elapsed})
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

  playFallbackVideo = async () => {
    const video = this.fallbackVideoRef
    if (!video) return

    if (isVideoPlaying(video)) return

    video.currentTime = this.elapsed

    try {
      await video.play()
    } catch (err) {
      console.error(`[cannot play fallback video]`, err)

      // something is wrong with the auto-play policy
      $canPlay.set(false)
    }
  }

  syncIpcTime(msg: IpcMessage) {
    const time = msg.dynamicMockedTime
    if (time !== null) this.mockTime(time)
  }
}

export const isVideoPlaying = (video: HTMLVideoElement) =>
  !!(
    video.currentTime > 0 &&
    !video.paused &&
    !video.ended &&
    video.readyState > 2
  )

export const automator = new ExhibitionAutomator()
automator.setup()
