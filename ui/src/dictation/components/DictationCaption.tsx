import {useStore} from '@nanostores/react'
import cn from 'classnames'

import {$transcript} from '../../store/dictation'

export const DictationCaption = () => {
  const {transcript, final} = useStore($transcript)

  if (!transcript) return null

  return (
    <div
      className={cn(
        'text-[28px] text-center break-words bg-black py-2 px-6 font-extralight',
        final && 'text-white',
        !final && 'text-gray-300'
      )}
    >
      {transcript}
    </div>
  )
}
