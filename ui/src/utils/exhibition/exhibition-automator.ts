import dayjs, {Dayjs} from 'dayjs'
import {nanoid} from 'nanoid'
import {
  AutomationCue,
  PROGRAM_CUES,
  PROGRAM_ZERO_END_TIME,
  PROGRAM_ZERO_START_TIME,
} from '../../constants/exhibition-cues'
import {loadTranscriptCue} from './cue-from-transcript'
import {getCurrentCue} from './get-current-cue'
import {
  AutomatorContext,
  runAutomationAction,
  runScreeningStartTask,
} from './run-automation-action'

import {secOf, timecodeOf, hhmmOf, hhmmssOf} from './timecode'

import {
  $disconnected,
  $exhibitionMode,
  $exhibitionStatus,
  $canPlay,
  $videoMode,
  $muted,
} from '../../store/exhibition'
import {getExhibitionStatus} from './get-exhibition-status'
import {match} from 'ts-pattern'
import {routeFromCue} from './route-from-cue'
import {$ipcMode, IpcAction, IpcMessage, IpcMeta} from '../../store/window-ipc'
import {resetAll} from './reset'
import {compareTimecode} from './compare-timecode'
import {transcriptWithinTimeRange} from './exclude-transcription-before'
import {$programTimestamp} from '../../store/timestamps'
import {getServerTimeDrift} from './get-system-time-drift'

export class ExhibitionAutomator {
  timer: number | null = null
  driftTimer: number | null = null

  cues: AutomationCue[] = []
  currentCue = -1

  // singapore usually drifts by 2 seconds
  timeDrift: number = 2

  private startTime: Dayjs | null = null

  ipc = new BroadcastChannel('exhibition-ipc')
  ipcId = nanoid()

  videoRef: HTMLVideoElement | null = null

  // for emergency fallback video, when the GPU server crashes.
  fallbackVideoRef: HTMLVideoElement | null = null

  // allows emulation of time
  now = () => new Date(new Date().getTime() + this.timeDrift)

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

  async computeDrift() {
    try {
      const medianDrift = await getServerTimeDrift()
      this.timeDrift = medianDrift

      console.log(`Final result: Median drift is ${medianDrift}ms`)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  async setup() {
    this.computeDrift()

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

    const isVideo = this.isVideo

    const shouldPlayFallbackVideo =
      $exhibitionMode.get() &&
      $exhibitionStatus.get().type === 'active' &&
      !isVideo &&
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

        console.log(`[ipc] we play the video`, msg)
      })
      .exhaustive()
  }

  async playVideo() {
    if (!this.isVideo) return

    // if the video element is not ready, do nothing
    if (!this.videoRef) {
      console.log('[video] missing video ref')
      return
    }

    let elapsed = this.elapsed

    // if the video is already playing at the same time, do nothing
    if (
      isVideoPlaying(this.videoRef) &&
      this.videoRef.currentTime === elapsed
    ) {
      console.log(`[play video] already playing`)

      return
    }

    try {
      if (elapsed !== null && elapsed !== -1 && !isNaN(elapsed)) {
        this.videoRef.currentTime = elapsed
      } else {
        // re-configure start time
        const status = $exhibitionStatus.get()

        if (status.type === 'active') {
          this.configureStartTime(status.start)
        }

        elapsed = this.elapsed
        this.videoRef.currentTime = elapsed
      }

      if (elapsed === -1) {
        console.log(`[play video] video should not play yet.`)
        return
      }

      console.log(`[play video] at ${elapsed} seconds`)

      await this.videoRef.play()

      // auto-play policy is working
      $canPlay.set(true)
    } catch (err) {
      console.log(`[cannot play video]`, err)

      // try a "muted autoplay" instead
      await this.tryMutedAutoplay()
    }
  }

  async tryMutedAutoplay() {
    if (!this.videoRef) return

    this.videoRef.muted = true
    $muted.set(true)

    await this.videoRef.play()

    // something is wrong with the auto-play policy
    $canPlay.set(false)
  }

  async unmuteVideo() {
    if (!this.videoRef) return

    this.videoRef.muted = false

    $muted.set(false)
    $canPlay.set(true)

    if (!isVideoPlaying(this.videoRef)) {
      await this.videoRef.play()
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

  // How much is the current cue lagging behind the actual time?
  getCueDrift() {
    if (this.currentCue === -1) return

    const cueTime = secOf(this.cues[this.currentCue].time)
    const elapsed = this.elapsed

    return elapsed - cueTime
  }

  fixCueDrift() {
    const drift = this.getCueDrift()
    if (drift === undefined) return

    // do not address the drift if we are at the very first cues
    if (this.currentCue < 2) return

    if (Math.abs(drift) > 1) {
      const from = this.currentCue
      this.seekCue(timecodeOf(this.elapsed))

      const to = this.currentCue
      const diff = to - from

      if (diff > 0) {
        console.log(
          `[cue drift] by ${drift}s, jumped ${diff} cue (${from} to ${to})`
        )
      }
    }
  }

  startClock() {
    if (this.timer) {
      this.stopClock()
    }

    this.tick()

    this.timer = setInterval(() => {
      this.tick()
    }, 500)

    this.driftTimer = setInterval(() => {
      this.fixCueDrift()
    }, 3000)
  }

  stopClock() {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null

    if (this.driftTimer !== null) clearInterval(this.driftTimer)
    this.driftTimer = null

    console.log(`> clock stopped`)
  }

  load = async () => {
    let transcriptCues = await loadTranscriptCue()

    const rangeFilter = transcriptWithinTimeRange(
      PROGRAM_ZERO_START_TIME,
      PROGRAM_ZERO_END_TIME
    )

    // exclude transcription cues before the program start time.
    transcriptCues = transcriptCues
      .sort((a, b) => compareTimecode(a.time, b.time))
      .filter(rangeFilter)

    this.cues = [...transcriptCues, ...PROGRAM_CUES]

    // make sure the cues are sorted by time!
    this.cues = this.cues.sort((a, b) => compareTimecode(a.time, b.time))
  }

  tick() {
    if (this.canGo()) this.go()

    $programTimestamp.set(this.elapsed)
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

    if (this.currentCue !== cue) {
      this.currentCue = cue
      console.log(`seeking to cue ${cue} | t=${time}`)
    }
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

  get isVideo() {
    return window.location.href.includes('/video') || $videoMode.get()
  }

  sync(options: {force?: boolean} = {}) {
    const {force = false} = options

    // only activate when in exhibition mode
    const isExhibition = $exhibitionMode.get()
    if (!isExhibition) return

    const prev = $exhibitionStatus.get()
    const next = getExhibitionStatus(this.now())
    $exhibitionStatus.set(next)

    if (!force && JSON.stringify(prev) === JSON.stringify(next)) return

    if (next.type === 'active') {
      this.configureStartTime(next.start)
    }

    // HACK: is video??
    const isVideo = this.isVideo

    setTimeout(() => {
      match(next.type)
        .with('loading', () => {})
        .with('wait', () => {})
        .with('closed', () => {})
        .with('active', () => {
          if (!isVideo) {
            this.restoreRouteFromCue()
          }
        })
        .exhaustive()
    }, 50)

    if (isVideo) {
      console.log(`[is video]`)

      this.actionContext.navigate('/video')

      setTimeout(() => {
        automator.playVideo()
      }, 200)

      return
    }

    console.log(`> exhibition status changed:`, next)

    if (next.type !== 'active') {
      this.stopClock()
      this.startTime = null
    } else {
      resetAll()
      this.seekCue(timecodeOf(this.elapsed))

      // play cue zero
      if (this.currentCue === 0) {
        runScreeningStartTask()
      }

      if (automator.timer === null) automator.startClock()
    }

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
