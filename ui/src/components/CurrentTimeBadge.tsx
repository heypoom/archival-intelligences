import React, {useMemo} from 'react'
import {useStore} from '@nanostores/react'
import {$videoTimestamp, $programTimestamp} from '../store/timestamps'
import {useIsVideo} from '../hooks/useIsVideo'
import {timecodeOf} from '../utils/exhibition/timecode'

export function ProgramTimeBadge() {
  const videoTs = useStore($videoTimestamp)
  const programTs = useStore($programTimestamp)

  const isVideo = useIsVideo()
  const timestamp = isVideo ? videoTs : programTs

  const timecode = useMemo(() => {
    return timecodeOf(timestamp)
  }, [timestamp])

  if (!timestamp || timestamp < 1) return null

  return (
    <div className="bg-[#2d2d30] text-white leading-3 px-[5px] py-[4px] text-xs rounded-md">
      {timecode}
    </div>
  )
}
