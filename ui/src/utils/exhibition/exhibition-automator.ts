import dayjs from 'dayjs'
import {AutomationCue, PART_TWO_CUES} from '../../constants/exhibition-cues'
import {loadTranscriptCue} from './cue-from-transcript'
import {getCurrentCue} from './get-current-cue'
import {AutomatorContext, runAutomationAction} from './run-automation-action'

import {secOf, timecodeOf, hhmmOf} from './timecode'
import {getExhibitionStatus} from './get-exhibition-status'

export class ExhibitionAutomator {
  /** Current time in seconds */
  seconds = 0
  timer: number | null = null

  cues: AutomationCue[] = []
  currentCue = -1

  // allows emulation of time
  now = () => new Date()

  actionContext: AutomatorContext = {
    navigate: () => {},
    next: () => {},
    cue: () => this.currentCue,
    now: () => this.seconds,
  }

  constructor() {
    if (typeof window !== 'undefined') {
      // @ts-expect-error - make it available for debugging
      window.automator = this
    }
  }

  startClock() {
    if (this.timer) {
      clearInterval(this.timer)
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
    this.syncClock()

    if (this.canGo()) this.go()
  }

  go() {
    this.currentCue++

    const action = this.cues[this.currentCue]
    console.log(`running action cue ${this.currentCue}:`, action)

    this.actionContext.cue = () => this.currentCue
    this.actionContext.now = () => this.seconds
    runAutomationAction(action, this.actionContext)
  }

  canGo(): boolean {
    const nextCue = this.cues[this.currentCue + 1]
    if (!nextCue) return false

    const nextCueTime = secOf(nextCue.time)

    return this.seconds >= nextCueTime
  }

  seekCue(time: string) {
    const seq = getCurrentCue(time, this.cues)
    if (!seq) return

    const [cue] = seq
    this.currentCue = cue
  }

  sync() {
    const timing = this.getClock()
    if (!timing) {
      this.stopClock()
      return
    }

    const {timecode} = timing
    this.seekCue(timecode)

    console.log(`sync | tc=${timecode} | cue=${this.currentCue}`)

    if (automator.timer === null) automator.startClock()
  }

  getClock() {
    // time source
    const now = this.now()

    const status = getExhibitionStatus(now)
    if (status.type !== 'active') return

    const startedAt = dayjs(hhmmOf(status.start))
    const secondsSinceStart = dayjs(now).diff(startedAt, 'second')
    const timecode = timecodeOf(secondsSinceStart)

    return {secondsSinceStart, timecode}
  }

  /** Sync the automator time with wall clock */
  syncClock() {
    const timing = this.getClock()
    if (!timing) return

    this.seconds = timing.secondsSinceStart
  }

  /** Mock the time source. */
  mockTime(time: string, dynamic = true) {
    const origin = hhmmOf(time)

    if (!dynamic) {
      this.now = () => origin
      return
    }

    const begin = new Date()

    this.now = () => {
      // simulate passage of time
      const elapsed = dayjs().diff(begin, 'seconds')

      return dayjs(origin).add(elapsed, 'seconds').toDate()
    }
  }
}

export const automator = new ExhibitionAutomator()
automator.load()
