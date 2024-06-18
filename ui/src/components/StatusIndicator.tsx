import {useStore} from '@nanostores/react'
import cn from 'classnames'

import {$dictationState} from '../store/dictation.ts'
import {$apiReady, $generating} from '../store/prompt.ts'
import {isGoogleChrome} from '../utils/is-google-chrome.ts'
import {useMatchRoute} from '@tanstack/react-router'

const isChrome = isGoogleChrome()

export const StatusIndicator = () => {
  const mr = useMatchRoute()
  const isSpeechRoute = mr({to: '/'})

  const status = useStore($dictationState)
  const apiReady = useStore($apiReady)
  const generating = useStore($generating)

  const starting = status === 'starting'
  const listening = status === 'listening'
  const stopped = status === 'stopped'
  const failed = status === 'failed'

  if (!isChrome) {
    return (
      <div className="text-red-400 text-3xl p-6 font-bold">
        PLEASE USE GOOGLE CHROME.
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-x-2">
      <div
        className={cn(
          'w-3 h-3 rounded-full',
          apiReady && 'bg-green-400',
          !apiReady && 'animate-pulse bg-red-400'
        )}
      />

      {isSpeechRoute && (
        <div
          className={cn(
            'w-3 h-3 rounded-full',
            starting && 'animate-pulse bg-yellow-400',
            listening && 'bg-green-400',
            stopped && 'bg-gray-600',
            failed && 'animate-pulse bg-red-400'
          )}
        />
      )}

      <div
        className={cn(
          'w-3 h-3 rounded-full',
          generating ? 'bg-green-400 animate-pulse' : 'bg-gray-600',
          !apiReady && 'animate-pulse bg-red-400'
        )}
      />
    </div>
  )
}
