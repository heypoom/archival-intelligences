import dayjs from 'dayjs'
import {AutomationCue, PART_TWO_CUES} from '../../constants/exhibition-cues'
import {loadTranscriptCue} from './cue-from-transcript'
import {getCurrentCue} from './get-current-cue'
import {AutomatorContext, runAutomationAction} from './run-automation-action'

import {secOf, timecodeOf, hhmmOf} from './timecode'

import {$exhibitionStatus} from '../../store/exhibition'
import {getExhibitionStatus} from './get-exhibition-status'

export class ExhibitionAutomator {
  timer: number | null = null

  cues: AutomationCue[] = []
  currentCue = -1

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
    if (this.canGo()) this.go()
  }

  go() {
    this.currentCue++

    const action = this.cues[this.currentCue]
    console.log(`running action cue ${this.currentCue}:`, action)

    this.actionContext.cue = () => this.currentCue
    this.actionContext.elapsed = () => this.elapsed
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
    if (!seq) return

    const [cue] = seq
    this.currentCue = cue
  }

  sync() {
    const status = $exhibitionStatus.get()

    if (status.type !== 'active') {
      this.stopClock()
      return
    }

    const elapsed = this.elapsed
    const timecode = timecodeOf(elapsed)
    this.seekCue(timecode)

    console.log(`sync | tc=${timecode} | cue=${this.currentCue} | e=${elapsed}`)

    if (automator.timer === null) automator.startClock()
  }

  get elapsed(): number {
    const status = $exhibitionStatus.get()
    if (status.type !== 'active') return -1

    const start = dayjs(hhmmOf(status.start))

    return dayjs(this.now()).diff(start, 'seconds')
  }

  /** Mock the time source. */
  mockTime(time: string, dynamic = true) {
    const origin = hhmmOf(time)

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

  syncStatus() {
    const current = $exhibitionStatus.get()
    const next = getExhibitionStatus(this.now())

    $exhibitionStatus.set(next)

    return {current, next}
  }
}

export const automator = new ExhibitionAutomator()
automator.load()
