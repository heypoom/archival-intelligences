import cx from 'classnames'
import {ComponentProps} from 'react'

interface Props {
  input?: ComponentProps<'input'>
  className?: string
}

export const PromptInput = ({input, className}: Props) => {
  return (
    <div>
      <input
        style={{fontFamily: 'Monaco'}}
        className={cx(
          'bg-[#111] text-white p-2 text-2xl font-mono px-4 py-2 min-w-[980px] text-center',
          className
        )}
        {...input}
      />
    </div>
  )
}
