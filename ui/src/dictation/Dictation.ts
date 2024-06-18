import {nanoid} from 'nanoid'
import {
  $dictationState,
  $latestTranscript,
  $transcripts,
} from '../store/dictation'

import {socket} from '../manager/socket.ts'
import {$apiReady, $generating} from '../store/prompt.ts'

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition

const MAX_TRANSCRIPT = 20
const RESTART_LIMIT = 80

const DELAY_BEFORE_START = 20
const WATCHDOG_TIMEOUT = 1000 * 7

export class Dictation {
  // Dictation Watchdog Timer
  silenceWatchdog = 0

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
      this.restart('watchdog')
    }, WATCHDOG_TIMEOUT)
  }

  start = () => {
    if (this.listening && this.recognition) return

    this.restartWatchdog()

    $dictationState.set('starting')

    this.recognition = new SpeechRecognition()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = 'en-US'

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
    if (reason) {
      console.log(`[speech] restarting due to "${reason}"`)
    }

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
    const {results} = event
    const latest = results.item(results.length - 1)
    const first = latest.item(0)

    this.restartWatchdog()

    if (latest.isFinal) {
      await this.processFinalTranscript(first.transcript)
    }

    if (!latest.isFinal) {
      const prev = [...results].map((r) => r.item(0).transcript).join(' ')
      console.log(prev)

      const len = prev.split(' ').length

      if (len <= MAX_TRANSCRIPT) {
        $latestTranscript.set({
          transcript: prev,
          final: false,
        })
      }

      if (len > RESTART_LIMIT) {
        this.restart('too many words')
      }
    }
  }

  async processFinalTranscript(transcript: string) {
    // Create an identifier to correlate transcript, image prompt and generated images.
    const id = nanoid()

    const logs = [...$transcripts.get()]
    if (logs.length > MAX_TRANSCRIPT) logs.splice(MAX_TRANSCRIPT)

    logs.unshift({id, transcript})
    $transcripts.set(logs)

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
