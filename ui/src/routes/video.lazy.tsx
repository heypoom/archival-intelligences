import {createLazyFileRoute} from '@tanstack/react-router'
import cx from 'classnames'

import {automator} from '../utils/exhibition/exhibition-automator'
import {$exhibitionStatus, $canPlay} from '../store/exhibition'
import {useStore} from '@nanostores/react'
import {EXHIBITION_VIDEO_SOURCES} from '../constants/exhibition-videos'

import {fullscreen} from '../utils/commands'

export const Route = createLazyFileRoute('/video')({
  component: VideoRoute,
})

function VideoRoute() {
  const status = useStore($exhibitionStatus)
  const canPlay = useStore($canPlay)

  const isVideoShown = status.type === 'active'

  return (
    <div className="flex flex-col items-center justify-center h-full font-mono min-h-screen bg-black text-white gap-y-8 relative">
      {!canPlay && (
        <div
          className="flex items-center justify-center absolute w-full h-full z-50 bg-black bg-opacity-70 cursor-pointer"
          onClick={() => {
            automator.playVideo(null)
            fullscreen()
          }}
        >
          <div className="border border-green-300 text-green-300 px-4 py-2">
            click anywhere to allow video to play
          </div>
        </div>
      )}

      <video
        src={EXHIBITION_VIDEO_SOURCES.lecture}
        ref={(ref) => ref && automator.initVideo(ref)}
        className={cx(isVideoShown ? 'opacity-100' : 'opacity-0')}
        onClick={() => automator.playVideo(null)}
      ></video>
    </div>
  )
}
