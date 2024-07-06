import {timecodeOf} from './timecode'

import {AutomationCue} from '../../constants/exhibition-cues'
import {GladiaTranscript} from '../../types/gladia-transcript'

const SHORT_SENTENCE_WORD_COUNT = 5
const FINAL_COUNTER = 10

export async function loadTranscriptCue(): Promise<AutomationCue[]> {
  const body = await fetch('/transcription.json')
  const transcript: GladiaTranscript = await body.json()

  return getCueFromTranscript(transcript)
}

export function getCueFromTranscript(
  transcript: GladiaTranscript
): AutomationCue[] {
  const cues: AutomationCue[] = []

  let counter = 0

  for (const u of transcript.transcription.utterances) {
    let final = false

    if (u.words.length <= SHORT_SENTENCE_WORD_COUNT) {
      // ignore short sentences
    } else if (counter === 0) {
      final = true
      counter = FINAL_COUNTER
    } else {
      counter--
      if (counter < 0) counter = 0
    }

    cues.push({
      action: 'transcript',
      time: timecodeOf(u.start),
      transcript: u.text,
      final,
    })
  }

  return cues
}
