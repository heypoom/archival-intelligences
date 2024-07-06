import {getCurrentSequence} from './get-current-sequence'
import {AutomatorContext, runAutomationAction} from './run-automation-sequence'

import {getAutomationSequences} from '../../constants/exhibition-sequences'

export class ExhibitionAutomator {
  currentCue = -1
  sequences = getAutomationSequences()
  actionContext: AutomatorContext = {navigate: () => {}, next: () => {}}

  constructor() {
    if (typeof window !== 'undefined') {
      // @ts-expect-error - make it available for debugging
      window.automator = this
    }
  }

  now = () => new Date()

  go() {
    this.currentCue++

    const action = this.sequences[this.currentCue]
    console.log(`running action cue ${this.currentCue}:`, action)
    runAutomationAction(action, this.actionContext)
  }

  seek(time: string) {
    const seq = getCurrentSequence(time)
    if (!seq) return

    const [cue, action] = seq

    if (cue <= this.currentCue) {
      return
    }

    this.currentCue = cue
    runAutomationAction(action, this.actionContext)
  }
}
