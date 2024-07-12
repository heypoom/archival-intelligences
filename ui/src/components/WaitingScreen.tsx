import {useStore} from '@nanostores/react'
import {useCallback, useEffect, useState} from 'react'
import dayjs from 'dayjs'
import cx from 'classnames'

import {$exhibitionStatus} from '../store/exhibition'

import {automator} from '../utils/exhibition/exhibition-automator'
import {hhmmOf, timecodeOf} from '../utils/exhibition/timecode'
import {useMatchRoute} from '@tanstack/react-router'

export function WaitingRoomScreen() {
  const status = useStore($exhibitionStatus)
  const [countdown, setCountdown] = useState('--:--:--')
  const mr = useMatchRoute()

  const tick = useCallback(() => {
    if (status.type !== 'wait') return

    const now = automator.now()
    const nextAt = hhmmOf(status.next)
    const seconds = dayjs(now).diff(nextAt, 'seconds')

    if (seconds < 0) {
      setCountdown(timecodeOf(Math.abs(seconds)))
    } else {
      setCountdown('00:00:00')
      console.log('waiting is over, begin next screening')
    }
  }, [status])

  useEffect(() => {
    const timer = setInterval(() => {
      tick()
    }, 500)

    return () => clearInterval(timer)
  }, [tick])

  if (mr({to: '/'})) return null

  return (
    <div
      className={cx(
        'fixed z-[100] left-0 top-0 flex flex-col items-center justify-center w-full h-full font-mono min-h-screen bg-black text-white gap-y-8 transition-opacity duration-[5s] ease-in-out',
        status.type === 'wait' ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
    >
      <h1 className="text-4xl">Next screening in {countdown}</h1>
    </div>
  )
}
