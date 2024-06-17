import {nanoid} from 'nanoid'
import {sentenceToImagePrompt} from '../prompt/prompt'
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
      console.log('--- it is too quiet. restarting watchdog.')

      this.restart()
    }, 1000 * 7)
  }

  start = () => {
    if (this.listening && this.recognition) return

    this.restartWatchdog()

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

  restart(reason?: string) {
    if (reason) {
      console.log(`[speech] restarting due to ${reason}`)
    }

    clearTimeout(this.silenceWatchdog)

    if (this.listening) {
      this.stop()

      setTimeout(() => {
        this.start()
      }, 40)
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
      // $latestTranscript.set({
      //   transcript: first.transcript,
      //   final: latest.isFinal,
      // })

      await this.processFinalTranscript(first.transcript)

      // $latestTranscript.set({
      //   transcript: '',
      //   final: false,
      // })
    }

    if (!latest.isFinal) {
      const prev = [...results].map((r) => r.item(0).transcript).join(' ')
      console.log(prev)

      const len = prev.split(' ').length
      if (len > 20) {
        console.log('--- over 20 words. stopping.')

         this.restart('over 20 words')
      } else {
        $latestTranscript.set({
          transcript: prev,
          final: false,
        })
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

    // const imagePrompt = await sentenceToImagePrompt(transcript)
    // if (!imagePrompt) return
    //
    // const prompts = [...$imagePrompts.get()]
    // if (prompts.length > MAX_PROMPTS) prompts.shift()
    //
    // prompts.push({ id, prompt: imagePrompt })
    // $imagePrompts.set(prompts)

    // Generate images from the prompt.
    // const images = await generateImage(imagePrompt)
    // console.log('gen images', images)
    //
    // const [image] = images ?? []
    // if (!image) return

    const isGenerating = $generating.get()
    console.log(`is generating: ${isGenerating}`)
    socket.speech = true

    if (!isGenerating) {
      console.log(`NOW GENERATING: ${transcript}`)

      try {
        socket.sock.send(`P0:${transcript}`)
        $generating.set(true)
      } catch (err) {
        $apiReady.set(false)
        $generating.set(false)

        socket.reconnectSoon('P0 generation error')
      }
    }

    // const imageUrls = [{ id, url }, ...$imageUrls.get()]
    // if (imageUrls.length > MAX_IMAGE_URLS) imageUrls.pop()
    //
    // $imageUrls.set(imageUrls)
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
