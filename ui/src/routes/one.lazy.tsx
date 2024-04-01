import { createLazyFileRoute } from '@tanstack/react-router'

import { AnimatedNoise } from '../components/AnimatedNoise'
import { PromptInput } from '../components/PromptInput.tsx'

export const Route = createLazyFileRoute('/one')({
  component: Index,
})

function Index() {
  return (
    <div className='flex'>
      <div className='fixed w-screen h-screen'>
        <div className='flex items-center justify-center w-full h-full'>
          <PromptInput />
        </div>
      </div>

      <AnimatedNoise />
    </div>
  )
}
