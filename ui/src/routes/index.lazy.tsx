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
    automator.sync({force: true})
  }

  // performance lecture mode
  function startLiveLecture() {
    $exhibitionMode.set(false)

    go({to: '/zero'})
  }

  // debug: start exhibition from a fake time
  function startFromFakeTime() {
    $exhibitionMode.set(true)
    const time = prompt('enter a test time in hh:mm:ss format')

    if (time) {
      automator.mockTime(time)
      automator.sync({force: true})
    }
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
          onClick={startLiveLecture}
          className="border border-blue-300 text-blue-300 px-4 py-2"
        >
          start live lecture
        </button>
      </div>

      <h2 className="text-xl">testing options</h2>

      <div>
        <div className="flex justify-center items-center gap-x-4 text-xs">
          <button
            onClick={startFromFakeTime}
            className="border border-gray-300 text-gray-300 px-3 py-2 text-xs"
          >
            start from a fake time
          </button>

          <div>simulate a time of day for the exhibition</div>
        </div>
      </div>
    </div>
  )
}
