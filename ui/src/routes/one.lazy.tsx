import {createLazyFileRoute} from '@tanstack/react-router'

import {GuidanceSlider} from '../components/GuidanceSlider'
import {PromptInput} from '../components/PromptInput'
import {useState} from 'react'

export const Route = createLazyFileRoute('/one')({
  component: Index,
})

function Index() {
  const [text, setText] = useState('')

  return (
    <div className="flex">
      <div className="fixed w-screen h-screen z-40">
        <div className="flex flex-col items-center justify-center w-full h-full">
          <PromptInput
            className="min-w-[600px]"
            input={{value: text, onChange: (e) => setText(e.target.value)}}
          />

          <div className="pt-4">
            <GuidanceSlider />
          </div>
        </div>
      </div>
    </div>
  )
}
