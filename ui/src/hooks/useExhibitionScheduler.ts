import {useEffect} from 'react'
import {useStore} from '@nanostores/react'

import {automator} from '../utils/exhibition/exhibition-automator'

import {$exhibitionMode} from '../store/exhibition'

// sync exhibition status every 3 seconds
const POLL_INTERVAL = 3000

export function useExhibitionScheduler() {
  const isExhibitionMode = useStore($exhibitionMode)

  useEffect(() => {
    let timer: number | undefined

    if (isExhibitionMode) {
      // @ts-expect-error - fffff
      timer = setInterval(() => {
        automator.sync()
      }, POLL_INTERVAL)

      automator.sync({force: true})
    } else {
      clearInterval(timer)
      automator.stopClock()
    }

    return () => clearInterval(timer)
  }, [isExhibitionMode])
}
