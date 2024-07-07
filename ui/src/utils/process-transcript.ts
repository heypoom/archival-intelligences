import {socket} from '../manager/socket'
import {$generating, $apiReady} from '../store/prompt'

export async function generateFromPrompt(prompt: string) {
  // Create an identifier to correlate transcript, image prompt and generated images.
  const isGenerating = $generating.get()

  if (!isGenerating) {
    console.log(`[GENERATING] ${prompt}`)

    try {
      socket.sock.send(`P0:${prompt}`)
      $generating.set(true)
    } catch (err) {
      $apiReady.set(false)
      $generating.set(false)

      socket.reconnectSoon('P0 socket send error')
    }
  }
}

/** Show N backlogs in dictation caption */
const MAX_TRANSCRIPT_BACKLOG = 1

/** Hide the backlog after N interim words */
const HIDE_BACKLOG_AFTER_N_INTERIM_WORDS = 6

/** Truncate transcription after N words */
const TRANSCRIPT_WORD_CUTOFF = 15

export function processInterimTranscript(
  results: {transcript: string; isFinal?: boolean}[]
) {
  const backlogs: string[] = []
  const interims: string[] = []

  for (const result of results) {
    const {transcript} = result

    if (result.isFinal) {
      backlogs.push(transcript)
    } else {
      interims.push(transcript)
    }
  }

  const backlogLimit = Math.max(backlogs.length - MAX_TRANSCRIPT_BACKLOG, 0)
  let wordBacklogs = backlogs.slice(backlogLimit).filter((x) => x)

  // If we have too many words in the interim, do not show the backlog.
  const interimWords = interims.flatMap((x) => x.split(' ')).filter((x) => x)
  if (interimWords.length > HIDE_BACKLOG_AFTER_N_INTERIM_WORDS)
    wordBacklogs = []

  const words = [...wordBacklogs, ...interimWords]
    .filter((x) => x)
    .flatMap((x) => x.split(' '))
    .filter((x) => x)

  const wordLimit = Math.max(words.length - TRANSCRIPT_WORD_CUTOFF, 0)
  const transcript = words.slice(wordLimit).join(' ')

  return {transcript, backlogLength: backlogs.length}
}
