import {createLazyFileRoute} from '@tanstack/react-router'

import {GuidanceSlider} from '../components/GuidanceSlider.tsx'
import {PromptInput} from '../components/PromptInput.tsx'
import {useHotkeys} from 'react-hotkeys-hook'

export const Route = createLazyFileRoute('/one')({
  component: Index,
})

const isFullscreen = () =>
  document.fullscreenElement ||
  // @ts-expect-error
  document.webkitFullscreenElement ||
  // @ts-expect-error
  document.mozFullScreenElement

function Index() {
  useHotkeys('space', () => {
    if (!isFullscreen()) {
      document.documentElement.requestFullscreen().then()
    }
  })

  return (
    <div className="flex">
      <div className="fixed w-screen h-screen z-40">
        <div className="flex flex-col items-center justify-center w-full h-full">
          <PromptInput className="min-w-[400px]" />

          <div className="pt-4">
            <GuidanceSlider />
          </div>
        </div>
      </div>
    </div>
  )
}
