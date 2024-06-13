import {createLazyFileRoute} from '@tanstack/react-router'

import {DictationCaption, dictation} from '../dictation'
import {ImageDisplay} from '../image/ImageDisplay'

import {useHotkeys} from 'react-hotkeys-hook'
import {useStore} from '@nanostores/react'
import {$apiReady} from '../store/prompt'

export const Route = createLazyFileRoute('/')({
  component: Index,
})

const isFullscreen = () =>
  document.fullscreenElement ||
  // @ts-expect-error
  document.webkitFullscreenElement ||
  // @ts-expect-error
  document.mozFullScreenElement

function Index() {
  const apiReady = useStore($apiReady)

  useHotkeys('space', () => {
    if (!isFullscreen()) {
      document.documentElement.requestFullscreen().then()
    }

    // Only allow dictation to start if the API is ready.
    if (apiReady) {
      dictation.restart()
    }
  })

  return (
    <main>
      <div className="fixed font-mono w-full min-h-screen flex left-0 justify-center items-center pt-12 pointer-events-none">
        <DictationCaption />
      </div>

      <ImageDisplay />
    </main>
  )
}
