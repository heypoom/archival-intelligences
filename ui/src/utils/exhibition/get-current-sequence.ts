import {
  AutomationSequence,
  getAutomationSequences,
} from '../../constants/exhibition-sequences'

const secOf = (timecode: string): number => {
  const [sh, sm, ss] = timecode.split(':').map(Number)

  return sh * 3600 + sm * 60 + ss
}

export function getCurrentSequence(
  timecode: string,
  seqs: AutomationSequence[] = getAutomationSequences()
): [number, AutomationSequence] | null {
  const now = secOf(timecode)

  for (let i = seqs.length - 1; i >= 0; i--) {
    const seq = seqs[i]
    const sec = secOf(seq.time)
    if (sec <= now) return [i, seq]
  }

  return null
}
