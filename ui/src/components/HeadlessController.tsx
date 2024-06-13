import {useEffect} from 'react'
import {useSceneSwitcher} from '../hooks/useSceneSwitcher'
import {isGoogleChrome} from '../utils/is-google-chrome'

export const HeadlessController = () => {
  useSceneSwitcher()

  return null
}
