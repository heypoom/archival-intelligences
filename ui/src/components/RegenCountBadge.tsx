import {useStore} from '@nanostores/react'
import {$regenActive, $regenCount} from '../store/regen'
import {useIsVideo} from '../hooks/useIsVideo'

export function RegenCountBadge() {
  const regenCount = useStore($regenCount)
  const regenActive = useStore($regenActive)

  const isVideo = useIsVideo()
  if (isVideo) return null

  // hide program badge when on the speech route
  if (!regenActive) return null

  return (
    <div className="bg-[#2d2d30] text-white leading-3 px-[5px] py-[4px] text-xs rounded-md font-mono">
      G{regenCount}
    </div>
  )
}
