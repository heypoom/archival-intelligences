import {useHotkeys} from 'react-hotkeys-hook'

import {useSceneSwitcher} from '../hooks/useSceneSwitcher'
import {useExhibitionAutomator} from '../hooks/useExhibitionAutomator'
import {useExhibitionScheduler} from '../hooks/useExhibitionScheduler'

export const HeadlessController = () => {
  const cmd = useSceneSwitcher()
  const automator = useExhibitionAutomator()

  useExhibitionScheduler()

  useHotkeys('CTRL + F', cmd.fullscreen)
  useHotkeys('CTRL + B', cmd.black)
  useHotkeys('LeftArrow', cmd.prev)
  useHotkeys('RightArrow', cmd.next)
  useHotkeys('CTRL + G', () => automator.go())

  return null
}
