import {useCallback, useEffect} from 'react'
import {useNavigate} from '@tanstack/react-router'

import {automator} from '../utils/exhibition/exhibition-automator'

export function useExhibitionScheduler() {
  const go = useNavigate()

  // idempotent sync exhibition status
  const sync = useCallback(() => {
    const {prev, next} = automator.sync()

    if (prev.type !== next.type) {
      console.log('status |', {prev, next})

      // TODO: check which window we are in (video versus program)

      if (next.type === 'active') go({to: '/'})
      if (next.type === 'wait') go({to: '/waiting'})
      if (next.type === 'closed') go({to: '/closed'})
    }
  }, [go])

  useEffect(() => {
    sync()
  }, [sync])

  return {
    sync,
  }
}
