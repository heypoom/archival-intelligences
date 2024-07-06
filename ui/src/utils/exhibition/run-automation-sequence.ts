import {match} from 'ts-pattern'
import {Tween, Easing} from '@tweenjs/tween.js'

import {AutomationAction} from '../../constants/exhibition-sequences'
import {$fadeStatus} from '../../store/fader'
import {$guidance} from '../../store/guidance'
import {$prompt} from '../../store/prompt'
import {keystrokeStream, getRandomDelay} from './keystroke-stream'
import {
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
}

export function runAutomationAction(
  action: AutomationAction,
  context: AutomatorContext
) {
  const {next, navigate} = context

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

        if (!result.done) {
          $prompt.set(result.value)

          const delay = getRandomDelay(base, variance)
          setTimeout(update, delay)
        } else if (!commit) {
          // do nothing
        } else if (action.enter && action.program) {
          startInference({
            command: action.program,
            regenerate: action.enter.regen,
          })
        } else if (action.program) {
          onPromptCommitted({
            input: action.prompt,
            command: action.program,
            guidance: $guidance.get(),
          })
        }
      }

      update()
    })
    .with({action: 'next'}, next)
    .with({action: 'transcript'}, (action) => {
      $transcript.set({transcript: action.transcript, final: false})

      if (action.final) {
        processFinalTranscript(action.transcript)
      }
    })
    .with({action: 'end'}, () => {
      // navigate('/countdown')
      console.log('end of show. todo: show a countdown')
    })
    .exhaustive()
}
