import {createLazyFileRoute} from '@tanstack/react-router'

export const Route = createLazyFileRoute('/video')({
  component: VideoRoute,
})

function VideoRoute() {
  return (
    <div>
      <video src="https://images.poom.dev/history-v1.mp4" />
    </div>
  )
}
