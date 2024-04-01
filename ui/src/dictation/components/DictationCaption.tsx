import {useStore} from '@nanostores/react'
import cn from 'classnames'

import {$latestTranscript} from '../../store/dictation'

export const DictationCaption = () => {
  const {transcript, final} = useStore($latestTranscript)

  return (
    <div
      className={cn(
        'text-xl text-center break-words bg-black py-2 px-6',
        final && 'text-white',
        !final && 'text-gray-300'
      )}
    >
      {transcript}
    </div>
  )
}
