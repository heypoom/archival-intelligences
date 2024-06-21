import {$dictationState, $transcript} from '../store/dictation'

import {socket} from '../manager/socket.ts'
import {$apiReady, $generating} from '../store/prompt.ts'

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition

/** Show N backlogs in dictation caption */
const MAX_TRANSCRIPT_BACKLOG = 1

/** Hide the backlog after N interim words */
const HIDE_BACKLOG_AFTER_N_INTERIM_WORDS = 6

/** Truncate transcription after N words */
const TRANSCRIPT_WORD_CUTOFF = 15

/** Forcibly restart the recognizer after N words */
const FORCE_RESTART_BACKLOG_LIMIT = 20

/** Delay for N milliseconds before starting recognizer again */
const DELAY_BEFORE_START = 10

/** Wait for N milliseconds of total silence before restarting */
const WATCHDOG_TIMEOUT = 1000 * 7

export class Dictation {
  // Dictation Watchdog Timer
  silenceWatchdog = 0
  restarting = false

  get listening() {
    return $dictationState.get() === 'listening'
  }

  private recognition: SpeechRecognition | null = null

  restartWatchdog() {
    if (this.silenceWatchdog) {
      window.clearTimeout(this.silenceWatchdog)
    }

    // It's too quiet. Restart the recognition.
    this.silenceWatchdog = window.setTimeout(() => {
      // alternative logic: check if path is not ROOT
      if (!this.recognition) {
        console.log('[speech] recognition gone - not restarting watchdog.')
        return
      }

      this.restart('watchdog')
    }, WATCHDOG_TIMEOUT)
  }

  start = () => {
    if (this.listening && this.recognition) return

    this.restarting = false
    this.restartWatchdog()

    $dictationState.set('starting')

    this.recognition = new SpeechRecognition()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = 'en-SG'

    this.recognition.addEventListener(
      'audiostart',
      this.onAudioStart.bind(this)
    )

    this.recognition.addEventListener('result', this.onResult.bind(this))
    this.recognition.addEventListener('error', this.onError.bind(this))
    this.recognition.addEventListener('end', this.onEnd.bind(this))

    this.recognition.start()
  }

  restart(reason: string) {
    if (this.restarting) {
      return
    }

    if (reason) {
      console.log(`[speech] restarting due to "${reason}"`)
    }

    this.restarting = true

    clearTimeout(this.silenceWatchdog)

    if (this.listening) {
      this.stop()

      setTimeout(() => {
        this.start()
      }, DELAY_BEFORE_START)
    } else {
      this.start()
    }
  }

  onAudioStart() {
    $dictationState.set('listening')
  }

  async onResult(event: SpeechRecognitionEvent) {
    console.log(`i hear`)

    const {results} = event
    const latest = results.item(results.length - 1)
    const first = latest.item(0)

    this.restartWatchdog()

    if (latest.isFinal) {
      await this.processFinalTranscript(first.transcript)
      return
    }

    await this.processInterimTranscript(results)
  }

  async processInterimTranscript(results: SpeechRecognitionResultList) {
    const backlogs: string[] = []
    const interims: string[] = []

    for (const result of results) {
      const transcript = result.item(0).transcript

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

    $transcript.set({transcript, final: false})

    if (backlogs.length > FORCE_RESTART_BACKLOG_LIMIT) {
      this.restart('too many backlogs')
    }
  }

  async processFinalTranscript(transcript: string) {
    // Create an identifier to correlate transcript, image prompt and generated images.
    const isGenerating = $generating.get()

    if (!isGenerating) {
      console.log(`[GENERATING] ${transcript}`)

      try {
        socket.sock.send(`P0:${transcript}`)
        $generating.set(true)
      } catch (err) {
        $apiReady.set(false)
        $generating.set(false)

        socket.reconnectSoon('P0 socket send error')
      }
    }
  }

  onError(event: SpeechRecognitionErrorEvent) {
    // restart the recognition if speech is not detected
    if (event.error === 'no-speech') {
      this.restart('error of no-speech')

      return
    }

    $dictationState.set('failed')

    if (event.error === 'aborted') {
      this.restart('error of aborted')

      return
    }
  }

  onEnd() {
    console.log('[speech] recognition end')
  }

  stop = () => {
    $dictationState.set('stopped')
    this.recognition?.stop()
    this.recognition = null
  }
}

// Dictation singleton.
export const dictation = new Dictation()
