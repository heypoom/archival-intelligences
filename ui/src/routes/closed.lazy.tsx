import {createFileRoute} from '@tanstack/react-router'

export const Route = createFileRoute('/closed')({
  component: ClosedRoute,
})

export function ClosedRoute() {
  return <div>exhibition is closed for the day</div>
}
