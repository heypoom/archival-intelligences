import {createLazyFileRoute} from '@tanstack/react-router'

import {GuidanceSlider} from '../components/GuidanceSlider'
import {PromptInput} from '../components/PromptInput'

export const Route = createLazyFileRoute('/one')({
  component: Index,
})

function Index() {
  return (
    <div className="flex">
      <div className="fixed w-screen h-screen z-40">
        <div className="flex flex-col items-center justify-center w-full h-full">
          <PromptInput className="min-w-[600px]" />

          <div className="pt-4">
            <GuidanceSlider />
          </div>
        </div>
      </div>
    </div>
  )
}
