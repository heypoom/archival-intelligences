import {useStore} from '@nanostores/react'
import cn from 'classnames'

import {$transcript} from '../../store/dictation'
import {$exhibitionMode} from '../../store/exhibition'

export const DictationCaption = () => {
  const {transcript, final} = useStore($transcript)
  const isExhibition = useStore($exhibitionMode)

  if (!transcript) return null

  return (
    <div className="text-center max-w-[1200px] px-2">
      <div
        className={cn(
          'inline break-words bg-black py-2 px-6 font-extralight',
          final && 'text-white',
          !final && 'text-gray-300',
          isExhibition && 'text-[28px] leading-[44px]',
          !isExhibition && 'text-[36px] leading-[54px]'
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
