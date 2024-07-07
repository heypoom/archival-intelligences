import {AutomationCue, PART_TWO_CUES} from '../../constants/exhibition-cues'
import {loadTranscriptCue} from './cue-from-transcript'
import {getCurrentCue} from './get-current-cue'
import {AutomatorContext, runAutomationAction} from './run-automation-action'

import {secOf} from './timecode'

export class ExhibitionAutomator {
  /** Current time in seconds */
  seconds = 0
  timer = 0

  cues: AutomationCue[] = []
  currentCue = -1

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

    this.load()
  }

  startClock() {
    this.tick()

    this.timer = setInterval(() => {
      this.tick()
    }, 1000)
  }

  stopClock() {
    clearInterval(this.timer)
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
    this.seconds++

    if (this.shouldGo()) this.go()
  }

  go() {
    this.currentCue++

    const action = this.cues[this.currentCue]
    console.log(`running action cue ${this.currentCue}:`, action)

    this.actionContext.cue = () => this.currentCue
    this.actionContext.now = () => this.seconds
    runAutomationAction(action, this.actionContext)
  }

  shouldGo() {
    const nextCue = this.cues[this.currentCue + 1]

    return nextCue && this.seconds >= secOf(nextCue.time)
  }

  seek(time: string) {
    const seq = getCurrentCue(time, this.cues)
    if (!seq) return

    const [cue, action] = seq

    if (cue <= this.currentCue) {
      return
    }

    this.currentCue = cue
    runAutomationAction(action, this.actionContext)
  }
}
