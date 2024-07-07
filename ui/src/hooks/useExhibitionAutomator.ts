import {useEffect} from 'react'
import * as TWEEN from '@tweenjs/tween.js'
import {useNavigate} from '@tanstack/react-router'

import {useSceneSwitcher} from './useSceneSwitcher'

import {automator} from '../utils/exhibition/exhibition-automator'

export function useExhibitionAutomator() {
  const switcher = useSceneSwitcher()
  const navigate = useNavigate()

  // Update the tween engine.
  // Used to automate slowly dragging the guidance slider.
  useEffect(() => {
    const animate = (time: number) => {
      TWEEN.update(time)
      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [])

  // Keep the automator in sync with the switcher
  useEffect(() => {
    automator.actionContext.next = switcher.next
    automator.actionContext.navigate = (route) => navigate({to: route})
  }, [navigate, switcher.next])

  return automator
}
