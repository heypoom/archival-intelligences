import {useCallback, useEffect} from 'react'
import {useNavigate} from '@tanstack/react-router'

import {automator} from '../utils/exhibition/exhibition-automator'
import {match} from 'ts-pattern'

export function useExhibitionScheduler() {
  const go = useNavigate()

  // idempotent sync exhibition status
  const sync = useCallback(() => {
    automator.sync()
  }, [go])

  useEffect(() => {
    sync()
  }, [sync])

  return {
    sync,
  }
}
