import {useStore} from '@nanostores/react'
import {$generating} from '../store/prompt'
import {$progress} from '../store/progress'
import {$regenActive} from '../store/regen'

export function ProgressBadge() {
  const generating = useStore($generating)
  const progress = useStore($progress)
  const regenActive = useStore($regenActive)

  if (!generating && !regenActive) return null
  if (progress === 0 && regenActive) return null

  let percent = Math.round(progress)
  if (!isNaN(percent) && !isFinite(percent)) {
    percent = 100
  } else if (!percent || isNaN(percent)) {
    percent = 0
  }

  return (
    <div className="bg-[#2d2d30] text-white leading-3 px-[5px] py-[4px] text-xs rounded-md">
      {percent}%
    </div>
  )
}
