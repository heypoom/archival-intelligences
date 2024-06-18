import cx from 'classnames'
import {ComponentProps, useRef, useState} from 'react'

interface Props {
  input?: ComponentProps<'input'>
  className?: string
}

export const PromptInput = ({input, className}: Props) => {
  const len = typeof input?.value === 'string' && input.value.length

  return (
    <div>
      <input
        style={{
          fontFamily: 'Monaco',
          minWidth: `max(calc(50px + ${len}ch), 400px)`,
        }}
        className={cx(
          'bg-[#111] text-white p-2 text-2xl font-mono px-4 py-2 text-center',
          className
        )}
        {...input}
      />
    </div>
  )
}
