import {createFileRoute} from '@tanstack/react-router'

export const Route = createFileRoute('/closed')({
  component: ClosedRoute,
})

export function ClosedRoute() {
  return (
    <div className="flex flex-col items-center justify-center h-full font-mono min-h-screen bg-black text-white gap-y-8">
      <h1 className="text-4xl">Exhibition is now closed.</h1>
      <h2 className="text-xl">Thanks for visiting!</h2>
    </div>
  )
}
