import {useStore} from '@nanostores/react'
import cn from 'classnames'

import {dictation} from '..'
import {$dictationState, DictationState} from '../../store/dictation'
import {$apiReady} from '../../store/prompt.ts'
import {isGoogleChrome} from '../../utils/is-google-chrome.ts'

const labelMap: Record<DictationState, string> = {
  stopped: 'start',
  starting: '(starting...)',
  listening: 'stop',
  failed: 'restart',
}

const isChrome = isGoogleChrome()

export const DictationTrigger = () => {
  const status = useStore($dictationState)
  const apiReady = useStore($apiReady)

  const label = labelMap[status]
  const starting = status === 'starting'
  const listening = status === 'listening'
  const stopped = status === 'stopped'
  const failed = status === 'failed'
  const apiNotReady = !apiReady

  if (!isChrome) {
    return (
      <div className="text-red-400 text-3xl p-6 font-bold">
        PLEASE USE GOOGLE CHROME.
      </div>
    )
  }

  if (apiNotReady) {
    return <div className="text-gray-400">waiting for server</div>
  }

  return (
    <button
      onClick={dictation.toggle}
      type="button"
      className={cn(
        'flex px-2 text-xs',
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
