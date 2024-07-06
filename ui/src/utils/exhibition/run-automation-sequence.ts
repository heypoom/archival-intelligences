import {match} from 'ts-pattern'
import {Tween, Easing} from '@tweenjs/tween.js'

import {AutomationAction} from '../../constants/exhibition-sequences'
import {$fadeStatus} from '../../store/fader'
import {$guidance} from '../../store/guidance'
import {$prompt} from '../../store/prompt'
import {keystrokeStream, getRandomDelay} from './keystroke-stream'

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
        .start()
    })
    .with({action: 'set-fade-status'}, (action) => {
      $fadeStatus.set(action.fade)
    })
    .with({action: 'navigate'}, (action) => {
      navigate(action.route)
    })
    .with({action: 'prompt'}, (action) => {
      const stream = keystrokeStream($prompt.get(), action.prompt)

      const update = () => {
        const result = stream.next()

        if (!result.done) {
          $prompt.set(result.value)

          const delay = getRandomDelay(100, 80)
          setTimeout(update, delay)
        }
      }

      update()
    })
    .with({action: 'next'}, next)
    .with({action: 'end'}, () => {
      navigate('/countdown')
    })
    .exhaustive()
}
