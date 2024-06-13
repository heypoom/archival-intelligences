import {useMatchRoute, useNavigate} from '@tanstack/react-router'
import {useHotkeys} from 'react-hotkeys-hook'
import {$generating, $inferencePreview, $prompt} from '../store/prompt'

const here = (a: false | object) => {
  if (a === false) return false
  if (typeof a === 'object') return true
}

export function useSceneSwitcher() {
  const route = useMatchRoute()
  const go = useNavigate()

  const zero = here(route({to: '/'}))
  const one = here(route({to: '/one'}))
  const two = here(route({to: '/two'}))
  const three = here(route({to: '/three'}))
  const four = here(route({to: '/four'}))

  function clearInference() {
    $prompt.set('')
    $generating.set(false)
    $inferencePreview.set('')
  }

  useHotkeys('space', () => {
    console.log('SPACE pressed')
  })

  useHotkeys('LeftArrow', () => {
    clearInference()

    if (zero) go({to: '/four'})
    if (one) go({to: '/'})
    if (two) go({to: '/one'})
    if (three) go({to: '/two'})
    if (four) go({to: '/three'})
  })

  useHotkeys('RightArrow', () => {
    if (zero) go({to: '/one'})
    if (one) go({to: '/two'})
    if (two) go({to: '/three'})
    if (three) go({to: '/four'})
    if (four) go({to: '/'})
  })

  useHotkeys('R', () => {
    console.log('R key pressed')
  })
}
