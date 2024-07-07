import {createLazyFileRoute, useNavigate} from '@tanstack/react-router'
import {$exhibitionMode} from '../store/exhibition'
import {automator} from '../utils/exhibition/exhibition-automator'

export const Route = createLazyFileRoute('/')({
  component: HomeRoute,
})

export function HomeRoute() {
  const go = useNavigate()

  // exhibition mode
  function startExhibition() {
    $exhibitionMode.set(true)
  }

  // performance lecture mode
  function startLiveProgram() {
    $exhibitionMode.set(false)
    go({to: '/zero'})
  }

  function fakeTime() {
    const time = prompt('enter a test time in hh:mm:ss format')
    if (time) automator.mockTime(time)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full font-mono min-h-screen bg-black text-white gap-y-8">
      <h1 className="text-2xl">program manager</h1>

      <div className="space-x-4">
        <button
          onClick={startExhibition}
          className="border border-green-300 text-green-300 px-4 py-2"
        >
          start exhibition
        </button>

        <button
          onClick={startLiveProgram}
          className="border border-blue-300 text-blue-300 px-4 py-2"
        >
          start live program
        </button>
      </div>

      <h2 className="text-xl">options</h2>

      <button
        onClick={fakeTime}
        className="border border-gray-300 text-gray-300 px-4 py-2"
      >
        fake time
      </button>
    </div>
  )
}
