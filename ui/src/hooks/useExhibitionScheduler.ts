import {useNavigate} from '@tanstack/react-router'
import {$exhibitionStatus} from '../store/exhibition'
import {getExhibitionStatus} from '../utils/exhibition/get-exhibition-status'
import {useCallback, useEffect} from 'react'
import {automator} from '../utils/exhibition/exhibition-automator'

export function useExhibitionScheduler() {
  const go = useNavigate()

  // idempotent sync exhibition status
  const sync = useCallback(() => {
    const {current, next} = automator.syncStatus()

    if (current.type !== next.type) {
      $exhibitionStatus.set(next)
      console.log('status |', {current, next})

      // TODO: check which window we are in (video versus program)
      if (next.type === 'active') {
        go({to: '/'})
        automator.sync()
      }

      if (next.type === 'wait') {
        go({to: '/waiting'})
      }

      if (next.type === 'closed') {
        go({to: '/closed'})
      }
    }
  }, [go])

  useEffect(() => {
    sync()
  }, [sync])

  return {
    sync,
  }
}
