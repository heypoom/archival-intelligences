import cx from 'classnames'
import {ComponentProps} from 'react'
import {$exhibitionMode} from '../store/exhibition'
import {useStore} from '@nanostores/react'

interface Props {
  input?: ComponentProps<'input'>
  className?: string
}

export const PromptInput = ({input, className}: Props) => {
  const len = typeof input?.value === 'string' && input.value.length

  const isExhibition = useStore($exhibitionMode)

  return (
    <div>
      <input
        style={{
          fontFamily: 'Monaco',
          minWidth: isExhibition
            ? `max(calc(50px + ${len}ch), 400px)`
            : `max(calc(50px + ${len}ch), 600px)`,
        }}
        className={cx(
          'bg-[#111] text-white font-mono text-center',
          isExhibition
            ? 'text-2xl p-2 px-4 py-2'
            : 'text-[42px] leading-[82px]',
          className
        )}
        {...input}
      />
    </div>
  )
}
