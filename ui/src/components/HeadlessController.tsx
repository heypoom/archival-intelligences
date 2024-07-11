import {useHotkeys} from 'react-hotkeys-hook'
import {useNavigate} from '@tanstack/react-router'

import {black, fullscreen} from '../utils/commands'

import {useSceneSwitcher} from '../hooks/useSceneSwitcher'

import {useExhibitionScheduler} from '../hooks/useExhibitionScheduler'
import {useExhibitionAutomator} from '../hooks/useExhibitionAutomator'

export const HeadlessController = () => {
  const cmd = useSceneSwitcher()
  const go = useNavigate()

  useExhibitionAutomator()
  useExhibitionScheduler()

  useHotkeys('CTRL + F', fullscreen)
  useHotkeys('CTRL + B', black)

  useHotkeys('LeftArrow', cmd.prev)
  useHotkeys('RightArrow', cmd.next)

  // go to settings
  useHotkeys('CTRL + H', () => go({to: '/'}))
  // useHotkeys('CTRL + G', () => atm.go())

  return null
}
