import {useStore} from '@nanostores/react'
import cn from 'classnames'

import {dictation} from '..'
import {$dictationState, DictationState} from '../../store/dictation'

const labelMap: Record<DictationState, string> = {
  stopped: 'start',
  starting: '(starting...)',
  listening: 'stop',
  failed: 'restart',
}

export const DictationTrigger = () => {
  const status = useStore($dictationState)

  const label = labelMap[status]
  const starting = status === 'starting'
  const listening = status === 'listening'
  const stopped = status === 'stopped'
  const failed = status === 'failed'

  return (
    <button
      onClick={dictation.toggle}
      type="button"
      className={cn(
        'flex px-2 text-xl',
        starting && 'animate-pulse text-blue-500',
        listening && 'text-red-500',
        stopped && 'text-green-500',
        failed && 'text-red-500'
      )}
      disabled={starting}
    >
      {label}
    </button>
  )
}
