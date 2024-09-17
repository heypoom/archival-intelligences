import {useStore} from '@nanostores/react'
import cn from 'classnames'

import {$transcript} from '../../store/dictation'

export const DictationCaption = () => {
  const {transcript, final} = useStore($transcript)

  if (!transcript) return null

  return (
    <div className="text-center max-w-[1200px] px-2">
      <div
        className={cn(
          'inline text-[28px] break-words bg-black py-2 px-6 font-extralight leading-[44px]',
          final && 'text-white',
          !final && 'text-gray-300'
        )}
        style={{
          boxDecorationBreak: 'clone',
        }}
      >
        {transcript}
      </div>
    </div>
  )
}
