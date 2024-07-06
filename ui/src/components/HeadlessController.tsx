import {useHotkeys} from 'react-hotkeys-hook'

import {useSceneSwitcher} from '../hooks/useSceneSwitcher'
import {useExhibitionAutomator} from '../hooks/useExhibitionAutomator'

export const HeadlessController = () => {
  const cmd = useSceneSwitcher()

  const automator = useExhibitionAutomator()

  useHotkeys('CTRL + F', cmd.fullscreen)
  useHotkeys('CTRL + B', cmd.black)
  useHotkeys('LeftArrow', cmd.prev)
  useHotkeys('RightArrow', cmd.next)
  useHotkeys('CTRL + G', () => automator.current?.go())

  return null
}
