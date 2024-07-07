import {useCallback, useEffect} from 'react'

import {automator} from '../utils/exhibition/exhibition-automator'
import {useStore} from '@nanostores/react'
import {$exhibitionMode} from '../store/exhibition'

// sync exhibition status every 3 seconds
const POLL_INTERVAL = 3000

export function useExhibitionScheduler() {
  const isExhibition = useStore($exhibitionMode)

  // idempotent sync exhibition status
  const sync = useCallback(() => {
    if (isExhibition) automator.sync()
  }, [isExhibition])

  useEffect(() => {
    const timer = setInterval(() => {
      sync()
    }, POLL_INTERVAL)

    sync()

    return () => clearInterval(timer)
  }, [sync])
}
