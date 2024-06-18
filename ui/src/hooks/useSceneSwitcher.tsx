import {useMatchRoute, useNavigate} from '@tanstack/react-router'
import {useHotkeys} from 'react-hotkeys-hook'
import {$generating, $inferencePreview, $prompt} from '../store/prompt'
import {$fadeStatus} from '../store/fader'
import {useStore} from '@nanostores/react'
import {resetProgress} from '../store/progress'

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
  const twoB = here(route({to: '/two-b'}))
  const three = here(route({to: '/three'}))
  const threeB = here(route({to: '/three-b'}))
  const four = here(route({to: '/four'}))
  const hasFadedBlack = useStore($fadeStatus)

  function clearInference() {
    $generating.set(false)
    resetProgress()
  }

  useHotkeys('CTRL + F', () => {
    document.documentElement.requestFullscreen().then()
  })

  useHotkeys('CTRL + B', () => {
    $fadeStatus.set(!$fadeStatus.get())
  })

  useHotkeys('LeftArrow', () => {
    clearInference()

    if (zero) go({to: '/four'})
    if (one) go({to: '/'})
    if (two) go({to: '/one'})
    if (twoB) go({to: '/two'})
    if (three) go({to: '/two-b'})
    if (threeB) go({to: '/three'})
    if (four) go({to: '/three-b'})
  })

  useHotkeys('RightArrow', () => {
    clearInference()

    if (zero) {
      if (hasFadedBlack) {
        go({to: '/one'})

        setTimeout(() => {
          // remove the inference preview image
          $inferencePreview.set('')
          $fadeStatus.set(false)
        }, 50)
      } else {
        $fadeStatus.set(true)
      }
    }

    if (one) go({to: '/two'})
    if (two) go({to: '/two-b'})
    if (twoB) go({to: '/three'})
    if (three) go({to: '/three-b'})
    if (threeB) go({to: '/four'})
    if (four) go({to: '/'})
  })
}
