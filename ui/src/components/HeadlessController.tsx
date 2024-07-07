import {useHotkeys} from 'react-hotkeys-hook'
import {useNavigate} from '@tanstack/react-router'

import {black, fullscreen} from '../utils/commands'

import {useSceneSwitcher} from '../hooks/useSceneSwitcher'
import {useExhibitionAutomator} from '../hooks/useExhibitionAutomator'
import {useExhibitionScheduler} from '../hooks/useExhibitionScheduler'

export const HeadlessController = () => {
  const cmd = useSceneSwitcher()
  const automator = useExhibitionAutomator()
  const go = useNavigate()

  useExhibitionScheduler()

  useHotkeys('CTRL + F', fullscreen)
  useHotkeys('CTRL + B', black)

  useHotkeys('LeftArrow', cmd.prev)
  useHotkeys('RightArrow', cmd.next)

  // go to settings
  useHotkeys('CTRL + H', () => go({to: '/'}))

  // debug: proceed to next cue
  useHotkeys('CTRL + G', () => automator.go())

  return null
}
