import { useStore } from '@nanostores/react'

import { $inferencePreview } from '../store/prompt.ts'

export const ImageDisplay = () => {
  const url = useStore($inferencePreview)

  return (
    <div className='flex items-center justify-center h-screen w-full bg-[#111]'>
      {url && <img src={url} alt='' className='h-screen' />}
    </div>
  )
}
