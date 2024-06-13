import {useStore} from '@nanostores/react'

import {$apiReady, $inferencePreview} from '../store/prompt.ts'
import {$dictationState} from '../store/dictation.ts'
import {useMemo} from 'react'

export const ImageDisplay = () => {
  const url = useStore($inferencePreview)

  const status = useStore($dictationState)
  const apiReady = useStore($apiReady)

  const background = useMemo(() => {
    if (!apiReady) return '#333'
    if (status === 'stopped' || status === 'failed') return '#222'

    return '#111'
  }, [status, apiReady])

  return (
    <div
      className="flex items-center justify-center h-screen w-full object-contain object-center"
      style={{background}}
    >
      {url && <img src={url} alt="" className="h-screen" />}
    </div>
  )
}
