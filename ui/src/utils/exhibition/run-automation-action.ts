import {match} from 'ts-pattern'
import {Tween, Easing} from '@tweenjs/tween.js'

import {AutomationAction} from '../../constants/exhibition-cues'
import {$fadeStatus} from '../../store/fader'
import {$guidance} from '../../store/guidance'
import {$prompt} from '../../store/prompt'
import {keystrokeStream, getRandomDelay} from './keystroke-stream'

import {
  delay,
  onGuidanceCommitted,
  onPromptCommitted,
  onPromptKeyChangeStart,
} from '../prompt-manager'

import {startInference} from '../inference'
import {$transcript} from '../../store/dictation'
import {processFinalTranscript} from '../process-transcript'

export interface AutomatorContext {
  next(): void
  navigate(route: string): void
  cue(): number
  now(): number
}

// Used to control transcription's word-by-word typing speed
const W_SAMPLE_DELAY_MS = 70
const W_LIMIT = 100000
const W_MIN_WORDS_FOR_TYPING = 1

export function runAutomationAction(
  action: AutomationAction,
  context: AutomatorContext
) {
  const {next, navigate} = context

  const now = context.now()
  const currentCue = context.cue()

  match(action)
    .with({action: 'start'}, () => {
      navigate('/')
    })
    .with({action: 'move-slider'}, (action) => {
      const guidance = {value: $guidance.get()}

      new Tween(guidance)
        .to({value: action.value}, 1000)
        .easing(Easing.Quadratic.InOut)
        .onUpdate(() => {
          $guidance.set(guidance.value)
        })
        .onComplete(() => {
          onGuidanceCommitted({command: action.program, value: action.value})
        })
        .start()
    })
    .with({action: 'set-fade-status'}, (action) => {
      $fadeStatus.set(action.fade)
    })
    .with({action: 'navigate'}, (action) => {
      navigate(action.route)
    })
    .with({action: 'prompt'}, (action) => {
      const {commit = true} = action

      onPromptKeyChangeStart()

      const stream = keystrokeStream($prompt.get(), action.prompt)
      const {base = 100, variance = 80} = action.delay ?? {}

      const update = () => {
        const result = stream.next()

        const backendPrompt = action.override ?? action.prompt

        if (!result.done) {
          $prompt.set(result.value)

          const delay = getRandomDelay(base, variance)
          setTimeout(update, delay)
        } else if (!commit) {
          // do nothing
        } else if (action.enter && action.program) {
          startInference({
            prompt: backendPrompt,
            command: action.program,
            regenerate: action.enter.regen,
          })
        } else if (action.program) {
          onPromptCommitted({
            input: backendPrompt,
            command: action.program,
            guidance: $guidance.get(),
          })
        }
      }

      update()
    })
    .with({action: 'next'}, next)
    .with({action: 'transcript'}, async (action) => {
      if (action.final) {
        processFinalTranscript(action.transcript)
      }

      if (action.words && action.words.length > W_MIN_WORDS_FOR_TYPING) {
        let sentence = ''
        let timePassed = 0
        const words = action.words.slice(0, -1)

        // prevent infinite loop
        let limit = 0

        // simulate hand-typing the transcript
        while (context.cue() === currentCue && words.length > 0) {
          if (limit++ > W_LIMIT) break

          const duration = now + timePassed / 1000
          const [word] = words

          if (duration > word.end) {
            words.shift()

            sentence += `${word.word} `
            $transcript.set({transcript: sentence, final: false})

            continue
          }

          timePassed += W_SAMPLE_DELAY_MS
          await delay(W_SAMPLE_DELAY_MS)
        }
      }

      $transcript.set({transcript: action.transcript, final: false})
    })
    .with({action: 'end'}, () => {
      // navigate('/countdown')
      console.log('end of show. todo: show a countdown')
    })
    .exhaustive()
}
