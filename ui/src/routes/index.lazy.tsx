import {createLazyFileRoute, useNavigate} from '@tanstack/react-router'
import {$exhibitionMode, $canPlay, $videoMode} from '../store/exhibition'
import {automator} from '../utils/exhibition/exhibition-automator'
import {useEffect} from 'react'
import {resetAll} from '../utils/exhibition/reset'
import {fullscreen} from '../utils/commands'

export const Route = createLazyFileRoute('/')({
  component: HomeRoute,
})

export function HomeRoute() {
  const go = useNavigate()

  useEffect(() => {
    resetAll()
  }, [])

  // exhibition mode - program
  function startExhibitionProgram() {
    $exhibitionMode.set(true)
    $videoMode.set(false)
    $canPlay.set(true)
    automator.sync({force: true})
    fullscreen()
  }

  // exhibition mode - video
  function startExhibitionVideo() {
    go({to: '/video'})
    $exhibitionMode.set(true)
    $videoMode.set(true)
    $canPlay.set(true)
    automator.sync({force: true})
    fullscreen()
  }

  // performance lecture mode
  function startLiveLecture() {
    $exhibitionMode.set(false)
    $canPlay.set(true)
    automator.stopClock()
    fullscreen()

    go({to: '/zero'})
  }

  // debug: start exhibition from a fake time
  function setFakeTime() {
    $canPlay.set(true)
    const time = prompt('enter a test time in hh:mm:ss format')

    if (time) {
      automator.mockTime(time)

      if ($videoMode.get()) {
        setTimeout(() => {
          go({to: '/video'})
        }, 150)
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full font-mono min-h-screen bg-black text-white gap-y-8">
      <h1 className="text-2xl">program manager</h1>

      <div className="space-x-4">
        <button
          onClick={startExhibitionProgram}
          className="border border-green-300 text-green-300 px-4 py-2"
        >
          exhibition - program screen
        </button>

        <button
          onClick={startExhibitionVideo}
          className="border border-yellow-300 text-yellow-300 px-4 py-2"
        >
          exhibition - video screen
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
            onClick={setFakeTime}
            className="border border-gray-300 text-gray-300 px-3 py-2 text-xs"
          >
            set a fake time
          </button>

          <div>simulate a time of day for the exhibition</div>
        </div>
      </div>
    </div>
  )
}
