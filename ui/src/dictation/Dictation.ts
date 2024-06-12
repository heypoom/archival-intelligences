import { nanoid } from 'nanoid'
import { sentenceToImagePrompt } from '../prompt/prompt'
import {
  $dictationState,
  $latestTranscript,
  $transcripts,
} from '../store/dictation'
import { $imagePrompts, $imageUrls } from '../store/images'
import { generateImage } from '../prompt/dalle'
import { socket } from '../manager/socket.ts'
import { $generating } from '../store/prompt.ts'

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition

const MAX_TRANSCRIPT = 20
const MAX_PROMPTS = 10
const MAX_IMAGE_URLS = 10

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
      this.onAudioStart.bind(this),
    )

    this.recognition.addEventListener('result', this.onResult.bind(this))
    this.recognition.addEventListener('error', this.onError.bind(this))
    this.recognition.addEventListener('end', this.onEnd.bind(this))

    this.recognition.start()
  }

  onAudioStart() {
    $dictationState.set('listening')
  }

  async onResult(event: SpeechRecognitionEvent) {
    const { results } = event

    const latest = results.item(results.length - 1)

    const first = latest.item(0)

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
      const prev = [...results].map(r => r.item(0).transcript).join(' ')
      console.log(prev)

      const len = prev.split(' ').length
      if (len > 20) {
        console.log('--- over 20 words. stopping.')

        this.stop()

        setTimeout(() => {
          this.start()
        }, 40)
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

    logs.unshift({ id, transcript })
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
    socket.speech = true

    if (!isGenerating) {
      console.log(`NOW GENERATING: ${transcript}`)
      socket.sock.send(`P0:${transcript}`)
      $generating.set(true)
    }

    // const imageUrls = [{ id, url }, ...$imageUrls.get()]
    // if (imageUrls.length > MAX_IMAGE_URLS) imageUrls.pop()
    //
    // $imageUrls.set(imageUrls)
  }

  onError(event: SpeechRecognitionErrorEvent) {
    // restart the recognition if speech is not detected
    if (event.error === 'no-speech') {
      this.stop()

      setTimeout(() => {
        this.start()
      }, 40)

      return
    }

    console.warn(`[speech] error of ${event.error}`, event.message)
    $dictationState.set('failed')

    if (event.error === 'aborted') {
      this.stop()

      setTimeout(() => {
        this.start()
      }, 40)

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
    document.documentElement.requestFullscreen().then()

    if (this.listening) return this.stop()

    this.start()
  }
}

// Dictation singleton.
export const dictation = new Dictation()
