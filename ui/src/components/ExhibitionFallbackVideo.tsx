import {useEffect} from 'react'
import {useStore} from '@nanostores/react'

import {$exhibitionStatus} from '../store/exhibition'

import {automator} from '../utils/exhibition/exhibition-automator'

import {EXHIBITION_VIDEO_SOURCES} from '../constants/exhibition-videos'
import {$programTimestamp} from '../store/timestamps'

/**
 * When the GPU server crashes, we show a fallback video to the audience.
 */
export const ExhibitionProgramVideo = () => {
  const status = useStore($exhibitionStatus)

  const isScreening = status.type === 'active'

  useEffect(() => {
    let timer: number | undefined = undefined

    if (isScreening) {
      timer = setInterval(() => {
        if (!automator.programVideoRef) return
        if (automator.programVideoRef.readyState < 3) return

        const actualTime = automator.programVideoRef.currentTime
        const expectedTime = automator.elapsed
        const drift = actualTime - expectedTime

        if (Math.abs(drift) > 1) {
          automator.programVideoRef.currentTime = expectedTime
          console.log(`[video] drift by ${drift}s`)
        }

        $programTimestamp.set(Math.round(automator.programVideoRef.currentTime))
      }, 1000)
    }

    return () => {
      clearInterval(timer)
    }
  }, [isScreening])

  if (!isScreening) return null

  return (
    <div className="fixed flex flex-col items-center justify-center w-full h-full font-mono min-h-screen bg-black text-white gap-y-8 z-[100002]">
      <video
        src={EXHIBITION_VIDEO_SOURCES.programVideo}
        ref={(ref) => ref && automator.initProgramVideo(ref)}
        onClick={automator.playProgramVideo}
        muted
      ></video>
    </div>
  )
}
