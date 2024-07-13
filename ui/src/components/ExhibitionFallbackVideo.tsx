import {useEffect} from 'react'
import {useStore} from '@nanostores/react'
import {useMatchRoute} from '@tanstack/react-router'

import {
  $disconnected,
  $exhibitionMode,
  $exhibitionStatus,
} from '../store/exhibition'

import {automator} from '../utils/exhibition/exhibition-automator'

import {EXHIBITION_VIDEO_SOURCES} from '../constants/exhibition-videos'
import {useIsVideo} from '../hooks/useIsVideo'

/**
 * When the GPU server crashes, we show a fallback video to the audience.
 */
export const ExhibitionFallbackVideo = () => {
  const isDisconnected = useStore($disconnected)
  const isExhibitionMode = useStore($exhibitionMode)
  const isVideo = useIsVideo()
  const mr = useMatchRoute()
  const status = useStore($exhibitionStatus)

  const isScreening = status.type === 'active'

  const hideFallback =
    isVideo ||
    !isDisconnected ||
    !isExhibitionMode ||
    !isScreening ||
    !!mr({to: '/'})

  useEffect(() => {
    let timer: number | undefined = undefined

    if (!hideFallback) {
      timer = setInterval(() => {
        if (!automator.fallbackVideoRef) return
        if (automator.fallbackVideoRef.readyState < 3) return

        const actualTime = automator.fallbackVideoRef.currentTime
        const expectedTime = automator.elapsed
        const drift = actualTime - expectedTime

        if (Math.abs(drift) > 1.5) {
          automator.fallbackVideoRef.currentTime = expectedTime
          console.log(`[video] drift by ${drift}s`)
        }
      }, 1000)
    }

    return () => {
      clearInterval(timer)
    }
  }, [hideFallback])

  if (hideFallback) return null

  return (
    <div className="fixed flex flex-col items-center justify-center w-full h-full font-mono min-h-screen bg-black text-white gap-y-8 z-[100002]">
      <video
        src={EXHIBITION_VIDEO_SOURCES.programFallback}
        ref={(ref) => ref && automator.initFallbackVideo(ref)}
        onClick={automator.playFallbackVideo}
        muted
      ></video>

      <div className="fixed right-5 bottom-5 w-4 h-4 rounded-full animate-pulse bg-red-500 z-[100005]" />
    </div>
  )
}
