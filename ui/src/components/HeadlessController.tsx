import {useHotkeys} from 'react-hotkeys-hook'

import {useSceneSwitcher} from '../hooks/useSceneSwitcher'
import {useExhibitionAutomator} from '../hooks/useExhibitionAutomator'
import {useExhibitionScheduler} from '../hooks/useExhibitionScheduler'
import {useNavigate} from '@tanstack/react-router'

export const HeadlessController = () => {
  const cmd = useSceneSwitcher()
  const automator = useExhibitionAutomator()
  const go = useNavigate()

  useExhibitionScheduler()

  useHotkeys('CTRL + F', cmd.fullscreen)
  useHotkeys('CTRL + B', cmd.black)
  useHotkeys('LeftArrow', cmd.prev)
  useHotkeys('RightArrow', cmd.next)

  // debug: proceed to next cue
  useHotkeys('CTRL + G', () => automator.go())

  // debug: go to settings
  useHotkeys('CTRL + H', () => go({to: '/'}))

  return null
}
