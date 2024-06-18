import {useMemo} from 'react'
import {useStore} from '@nanostores/react'
import cx from 'classnames'

import {$apiReady, $inferencePreview} from '../store/prompt.ts'
import {$dictationState} from '../store/dictation.ts'

export const ImageDisplay = () => {
  const url = useStore($inferencePreview)

  const status = useStore($dictationState)
  const apiReady = useStore($apiReady)

  const background = useMemo(() => {
    if (!apiReady) return '#222'
    if (status === 'stopped' || status === 'failed') return '#111'

    return '#111'
  }, [status, apiReady])

  const visible = !!url

  return (
    <div
      className="flex items-center justify-center h-screen w-full"
      style={{background}}
    >
      <img
        src={url}
        alt=""
        className={cx(
          'h-screen object-cover object-center transition-opacity duration-[5s] ease-in-out pointer-events-none select-none',
          visible ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  )
}
