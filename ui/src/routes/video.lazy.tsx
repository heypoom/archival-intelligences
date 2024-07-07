import {createLazyFileRoute} from '@tanstack/react-router'
import cx from 'classnames'

import {automator} from '../utils/exhibition/exhibition-automator'
import {$exhibitionStatus, $interacted} from '../store/exhibition'
import {useStore} from '@nanostores/react'
import {fullscreen} from '../utils/commands'

export const Route = createLazyFileRoute('/video')({
  component: VideoRoute,
})

function VideoRoute() {
  const status = useStore($exhibitionStatus)
  const interacted = useStore($interacted)

  function enableVideoPlayback() {
    $interacted.set(true)
    fullscreen()

    if (status.type === 'active') {
      automator.configureStartTime(status)
      automator.playVideo()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full font-mono min-h-screen bg-black text-white gap-y-8 relative">
      {!interacted && (
        <div className="flex items-center justify-center absolute w-full h-full">
          <button
            onClick={enableVideoPlayback}
            className="border border-green-300 text-green-300 px-4 py-2"
          >
            click here to allow video to play
          </button>
        </div>
      )}

      <video
        src="https://images.poom.dev/history-v1.mp4"
        ref={(ref) => ref && automator.initVideo(ref)}
        className={cx(status.type !== 'active' && 'invisible')}
      ></video>
    </div>
  )
}
