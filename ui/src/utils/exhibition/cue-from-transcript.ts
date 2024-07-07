import {timecodeOf} from './timecode'

import {AutomationCue} from '../../constants/exhibition-cues'
import {GladiaTranscript} from '../../types/gladia-transcript'

/** Exclude short sentences. */
const SHORT_SENTENCE_WORDS = 6

/** How long to wait until allowing next image generation cue? */
const GENERATION_CUE_WAIT_SECONDS = 15

export async function loadTranscriptCue(): Promise<AutomationCue[]> {
  const body = await fetch('/transcription.json')
  const transcript: GladiaTranscript = await body.json()

  return getCueFromTranscript(transcript)
}

export function getCueFromTranscript(
  transcript: GladiaTranscript
): AutomationCue[] {
  const cues: AutomationCue[] = []

  let firstTaken = false
  let lastFinalTime = 0

  for (const u of transcript.transcription.utterances) {
    let shouldGenerate = false

    if (u.words.length > SHORT_SENTENCE_WORDS) {
      const should_resume =
        u.start - lastFinalTime > GENERATION_CUE_WAIT_SECONDS

      if (should_resume || !firstTaken) {
        shouldGenerate = true
        lastFinalTime = u.start
      }

      if (!firstTaken) {
        firstTaken = true
      }
    }

    cues.push({
      action: 'transcript',
      time: timecodeOf(u.start),
      when: [u.start, u.end],
      transcript: u.text,
      generate: shouldGenerate,
      words: u.words,
    })
  }

  return cues
}
