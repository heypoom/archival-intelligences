import {createLazyFileRoute} from '@tanstack/react-router'
import {automator} from '../utils/exhibition/exhibition-automator'

export const Route = createLazyFileRoute('/video')({
  component: VideoRoute,
})

function VideoRoute() {
  return (
    <div className="flex flex-col items-center justify-center h-full font-mono min-h-screen bg-black text-white gap-y-8">
      <video
        src="https://images.poom.dev/history-v1.mp4"
        ref={(ref) => ref && automator.initVideo(ref)}
        controls
      ></video>
    </div>
  )
}
