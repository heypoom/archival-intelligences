import {createLazyFileRoute} from '@tanstack/react-router'

import {AnimatedNoise} from '../components/AnimatedNoise'
import {GuidanceSlider} from '../components/GuidanceSlider.tsx'
import {PromptInput} from '../components/PromptInput.tsx'

export const Route = createLazyFileRoute('/one')({
  component: Index,
})

function Index() {
  return (
    <div className="flex bg-[#424242]">
      <div className="fixed w-screen h-screen bg-transparent z-40">
        <div className="flex flex-col items-center justify-center w-full h-full">
          <PromptInput />

          <div className="pt-4">
            <GuidanceSlider />
          </div>
        </div>
      </div>

      <AnimatedNoise />
    </div>
  )
}
