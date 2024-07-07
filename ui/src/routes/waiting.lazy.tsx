import {useStore} from '@nanostores/react'
import {createLazyFileRoute} from '@tanstack/react-router'
import {useCallback, useEffect, useState} from 'react'
import dayjs from 'dayjs'

import {$exhibitionStatus} from '../store/exhibition'

import {automator} from '../utils/exhibition/exhibition-automator'
import {hhmmOf, timecodeOf} from '../utils/exhibition/timecode'

export const Route = createLazyFileRoute('/waiting')({
  component: WaitingRoomRoute,
})

export function WaitingRoomRoute() {
  const status = useStore($exhibitionStatus)
  const [countdown, setCountdown] = useState('--:--:--')

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
    }, 1000)

    return () => clearInterval(timer)
  }, [tick])

  return (
    <div className="flex flex-col items-center justify-center h-full font-mono min-h-screen bg-black text-white gap-y-8">
      <h1 className="text-4xl">Next screening in {countdown}</h1>
    </div>
  )
}
