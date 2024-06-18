import {useMemo} from 'react'
import {useStore} from '@nanostores/react'
import cx from 'classnames'

import {$apiReady, $inferencePreview} from '../store/prompt'
import {$dictationState} from '../store/dictation'
import {useCrossFade} from '../hooks/useCrossFade'

export const ImageDisplay = () => {
  const url = useStore($inferencePreview)

  const status = useStore($dictationState)
  const apiReady = useStore($apiReady)

  const {crossfading, prevUrl} = useCrossFade(url, true)

  const background = useMemo(() => {
    if (!apiReady) return '#222'
    if (status === 'stopped' || status === 'failed') return '#111'

    return '#111'
  }, [status, apiReady])

  const visible = !!url

  return (
    <div
      className="relative flex items-center justify-center h-screen w-full z-[1]"
      style={{background}}
    >
      <img
        src={crossfading ? prevUrl : url}
        alt=""
        className={cx(
          'absolute h-screen object-cover object-center transition-opacity duration-[3s] ease-in-out pointer-events-none select-none z-[1]',
          visible ? 'opacity-100' : 'opacity-0'
        )}
      />

      <img
        src={url}
        alt=""
        className={cx(
          'absolute h-screen object-cover object-center transition-opacity duration-[3s] ease-in-out pointer-events-none select-none z-[10]',
          crossfading ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  )
}
