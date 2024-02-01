import {useStore} from '@nanostores/react'
import cn from 'classnames'

import {$latestTranscript} from '../../store/dictation'

export const DictationCaption = () => {
  const {transcript, final} = useStore($latestTranscript)

  return (
    <div
      className={cn(
        'text-6xl text-center break-words',
        final && 'text-green-500',
        !final && 'text-gray-300'
      )}
    >
      {transcript}
    </div>
  )
}
