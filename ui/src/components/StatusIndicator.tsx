import cn from 'classnames'
import {useStore} from '@nanostores/react'
import {useMatchRoute} from '@tanstack/react-router'

import {$dictationState} from '../store/dictation'
import {$apiReady, $generating, $booting} from '../store/prompt'
import {$exhibitionMode, $offlineMode} from '../store/exhibition'
import {useIsVideo} from '../hooks/useIsVideo'

export const StatusIndicator = () => {
  const mr = useMatchRoute()
  const isSpeechRoute = mr({to: '/zero'})
  const isExhibition = useStore($exhibitionMode)
  const isOffline = useStore($offlineMode)

  const status = useStore($dictationState)
  const apiReady = useStore($apiReady)
  const generating = useStore($generating)
  const booting = useStore($booting)

  const isVideo = useIsVideo() || mr({to: '/program-video'})
  if (isVideo) return null

  if (isOffline) return null

  const shouldHideFromRoute = mr({to: '/image-viewer'})
  if (shouldHideFromRoute) return null

  const starting = status === 'starting'
  const listening = status === 'listening'
  const stopped = status === 'stopped'
  const failed = status === 'failed'

  return (
    <div className="flex items-center justify-center gap-x-2">
      <div
        className={cn(
          'w-3 h-3 rounded-full',
          apiReady && !booting && 'bg-green-400',
          !apiReady && 'animate-pulse bg-red-400',
          booting && 'animate-pulse bg-orange-400'
        )}
      />

      {isSpeechRoute && !isExhibition && (
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
          !apiReady && 'animate-pulse bg-red-400',
          booting && 'animate-pulse bg-orange-400'
        )}
      />
    </div>
  )
}
