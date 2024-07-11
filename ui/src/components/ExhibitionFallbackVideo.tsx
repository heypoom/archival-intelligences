import {useStore} from '@nanostores/react'
import {
  $disconnected,
  $exhibitionMode,
  $exhibitionStatus,
} from '../store/exhibition'
import {automator} from '../utils/exhibition/exhibition-automator'

import {EXHIBITION_VIDEO_SOURCES} from '../constants/exhibition-videos'
import {useIsVideo} from '../hooks/useIsVideo'
import {useMatchRoute} from '@tanstack/react-router'

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

  if (!isDisconnected) return null
  if (!isExhibitionMode || !isScreening) return null
  if (mr({to: '/'})) return null

  // only show the fallback video if we are in program mode
  if (isVideo) return null

  return (
    <div className="fixed flex flex-col items-center justify-center w-full h-full font-mono min-h-screen bg-black text-white gap-y-8 z-[100002]">
      <video
        src={EXHIBITION_VIDEO_SOURCES.programFallback}
        ref={(ref) => ref && automator.initFallbackVideo(ref)}
        onClick={automator.playFallbackVideo}
      ></video>

      <div className="fixed right-5 bottom-5 w-4 h-4 rounded-full animate-pulse bg-red-500 z-[100005]" />
    </div>
  )
}
