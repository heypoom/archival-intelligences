import {AutomationCue, PART_TWO_CUES} from '../../constants/exhibition-cues'
import {loadTranscriptCue} from './cue-from-transcript'
import {getCurrentCue} from './get-current-cue'
import {AutomatorContext, runAutomationAction} from './run-automation-action'

import {secOf} from './timecode'

export class ExhibitionAutomator {
  /** Current time in seconds */
  currentTime = 0
  currentCue = -1
  cues: AutomationCue[] = []
  actionContext: AutomatorContext = {navigate: () => {}, next: () => {}}

  constructor() {
    if (typeof window !== 'undefined') {
      // @ts-expect-error - make it available for debugging
      window.automator = this
    }

    this.load()
  }

  load = async () => {
    const transcriptCues = await loadTranscriptCue()

    this.cues = [
      {time: '00:00:00', action: 'start'},
      ...transcriptCues,
      ...PART_TWO_CUES,
    ]
  }

  now = () => new Date()

  go() {
    this.currentCue++

    const action = this.cues[this.currentCue]
    console.log(`running action cue ${this.currentCue}:`, action)
    runAutomationAction(action, this.actionContext)
  }

  shouldGo(_currentTime: string) {
    const currentTime = secOf(_currentTime)
    const nextCue = this.cues[this.currentCue + 1]

    return nextCue && currentTime >= secOf(nextCue.time)
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
