import {createLazyFileRoute} from '@tanstack/react-router'

export const Route = createLazyFileRoute('/waiting')({
  component: WaitingRoomRoute,
})

export function WaitingRoomRoute() {
  return (
    <div>
      <h1>Waiting Room</h1>
    </div>
  )
}
