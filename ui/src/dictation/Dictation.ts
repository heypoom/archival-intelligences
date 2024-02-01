import {
  $dictationState,
  $latestTranscript,
  $transcripts,
} from '../store/dictation'

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition

const MAX_TRANSCRIPT = 20

export class Dictation {
  get listening() {
    return $dictationState.get() === 'listening'
  }

  private recognition: SpeechRecognition | null = null

  start = () => {
    if (this.listening && this.recognition) return

    $dictationState.set('starting')

    this.recognition = new SpeechRecognition()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.maxAlternatives = 5
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

  onAudioStart() {
    $dictationState.set('listening')
  }

  onResult(event: SpeechRecognitionEvent) {
    const {results} = event

    const latest = results.item(results.length - 1)

    const first = latest.item(0)
    $latestTranscript.set({transcript: first.transcript, final: latest.isFinal})

    if (latest.isFinal) {
      const logs = [...$transcripts.get()]
      if (logs.length > MAX_TRANSCRIPT) logs.splice(MAX_TRANSCRIPT)

      logs.unshift(first.transcript)

      $transcripts.set(logs)
    }
  }

  onError(event: SpeechRecognitionErrorEvent) {
    console.warn(`[speech] error of ${event.error}`, event.message)
    $dictationState.set('failed')
  }

  onEnd() {}

  stop = () => {
    $dictationState.set('stopped')
    this.recognition?.stop()
    this.recognition = null
  }

  toggle = () => {
    if (this.listening) return this.stop()

    this.start()
  }
}

// Dictation singleton.
export const dictation = new Dictation()
