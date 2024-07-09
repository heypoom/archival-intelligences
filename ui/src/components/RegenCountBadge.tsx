import {useStore} from '@nanostores/react'
import {$regenActive, $regenCount} from '../store/regen'
import {$ipcMode} from '../store/window-ipc'

export function RegenCountBadge() {
  const regenCount = useStore($regenCount)
  const regenActive = useStore($regenActive)

  const ipcMode = useStore($ipcMode)
  if (ipcMode === 'video') return null

  // hide program badge when on the speech route
  if (!regenActive) return null

  return (
    <div className="bg-[#2d2d30] text-white leading-3 px-[5px] py-[4px] text-xs rounded-md">
      G{regenCount}
    </div>
  )
}
