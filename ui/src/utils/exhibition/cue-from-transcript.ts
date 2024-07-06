import {timecodeOf} from './timecode'

import {AutomationCue} from '../../constants/exhibition-cues'
import {GladiaTranscript} from '../../types/gladia-transcript'

/** Exclude short sentences. */
const SHORT_SENTENCE_WORDS = 6

/** How long to wait until allowing next cue? */
const CUE_WAIT_SECONDS = 20

export async function loadTranscriptCue(): Promise<AutomationCue[]> {
  const body = await fetch('/transcription.json')
  const transcript: GladiaTranscript = await body.json()

  return getCueFromTranscript(transcript)
}

export function getCueFromTranscript(
  transcript: GladiaTranscript
): AutomationCue[] {
  const cues: AutomationCue[] = []

  let first_taken = false
  let last_final_time = 0

  for (const u of transcript.transcription.utterances) {
    let final = false

    if (u.words.length > SHORT_SENTENCE_WORDS) {
      const should_resume = u.start - last_final_time > CUE_WAIT_SECONDS

      if (should_resume || !first_taken) {
        final = true
        last_final_time = u.start
      }

      if (!first_taken) {
        first_taken = true
      }
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
