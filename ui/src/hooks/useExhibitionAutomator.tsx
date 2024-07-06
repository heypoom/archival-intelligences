import {useEffect, useRef} from 'react'
import * as TWEEN from '@tweenjs/tween.js'

import {ExhibitionAutomator} from '../utils/exhibition/exhibition-automator'
import {useSceneSwitcher} from './useSceneSwitcher'
import {useNavigate} from '@tanstack/react-router'

export function useExhibitionAutomator() {
  const automator = useRef<ExhibitionAutomator>()
  const switcher = useSceneSwitcher()
  const navigate = useNavigate()

  useEffect(() => {
    automator.current = new ExhibitionAutomator()
  }, [])

  useEffect(() => {
    const animate = (time: number) => {
      TWEEN.update(time)
      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    if (automator.current) {
      automator.current.actionContext = {
        navigate: (route) => navigate({to: route}),
        next: switcher.next,
      }
    }
  }, [navigate, switcher.next])

  return automator
}
