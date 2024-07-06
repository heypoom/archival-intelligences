import {secOf} from './timecode'

import {AutomationCue} from '../../constants/exhibition-cues'

export function getCurrentCue(
  timecode: string,
  seqs: AutomationCue[]
): [number, AutomationCue] | null {
  const now = secOf(timecode)

  for (let i = seqs.length - 1; i >= 0; i--) {
    const seq = seqs[i]
    const sec = secOf(seq.time)
    if (sec <= now) return [i, seq]
  }

  return null
}
