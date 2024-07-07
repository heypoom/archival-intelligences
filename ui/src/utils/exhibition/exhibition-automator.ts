import dayjs, {Dayjs} from 'dayjs'
import {AutomationCue, PART_TWO_CUES} from '../../constants/exhibition-cues'
import {loadTranscriptCue} from './cue-from-transcript'
import {getCurrentCue} from './get-current-cue'
import {AutomatorContext, runAutomationAction} from './run-automation-action'

import {secOf, timecodeOf, hhmmOf} from './timecode'

import {$exhibitionMode, $exhibitionStatus} from '../../store/exhibition'
import {getExhibitionStatus} from './get-exhibition-status'
import {match} from 'ts-pattern'

export class ExhibitionAutomator {
  timer: number | null = null

  cues: AutomationCue[] = []
  currentCue = -1

  private startTime: Dayjs | null = null

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

  get elapsed(): number {
    if (this.startTime === null) return -1

    return dayjs(this.now()).diff(this.startTime, 'seconds')
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

  sync() {
    // only activate when in exhibition mode
    const isExhibition = $exhibitionMode.get()
    if (!isExhibition) return

    const prev = $exhibitionStatus.get()
    const next = getExhibitionStatus(this.now())

    // do not sync if the status is the same
    if (prev.type === next.type) return

    $exhibitionStatus.set(next)

    console.log(`> exhibition status changed:`, next)

    if (next.type !== 'active') {
      this.stopClock()
    } else {
      this.startTime = dayjs(hhmmOf(next.start))
      this.seekCue(timecodeOf(this.elapsed))

      if (automator.timer === null) automator.startClock()
    }

    const {navigate: go} = this.actionContext

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
        // TODO: restore current route from cue?
      })
      .exhaustive()

    return {prev, next}
  }
}

export const automator = new ExhibitionAutomator()
automator.load()
