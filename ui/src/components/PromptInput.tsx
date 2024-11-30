import cx from 'classnames'
import {ComponentProps, useEffect, useRef} from 'react'
import {$exhibitionMode} from '../store/exhibition'
import {useStore} from '@nanostores/react'

interface Props {
  input?: ComponentProps<'textarea'>
  className?: string
}

export const PromptInput = ({input, className}: Props) => {
  const isExhibition = useStore($exhibitionMode)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = 'auto'

      // Set the height to match the content
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`

      const value = String(input?.value)

      const initialWidth = 600
      const maxWidth = 1000

      // auto-expanding text
      const charactersTyped = value.length
      const widthRange = maxWidth - initialWidth
      const maxChars = 23

      const newWidth = Math.min(
        maxWidth,
        initialWidth +
          (widthRange * Math.min(charactersTyped, maxChars)) / maxChars
      )

      textareaRef.current.style.width = `${newWidth}px`
    }
  }, [input?.value])

  return (
    <div className="flex items-center justify-center max-w-[1000px] w-full">
      <textarea
        style={{
          fontFamily: 'Monaco',
          background: 'rgba(17, 17, 17, 0.5)',
          backdropFilter: 'blur(10px)',
        }}
        className={cx(
          'text-white font-mono text-center w-full',
          'resize-none overflow-hidden min-h-[40px]',

          isExhibition
            ? 'text-2xl p-2 px-4 py-2'
            : 'text-[42px] leading-[82px]',
          className
        )}
        rows={1}
        ref={textareaRef}
        {...input}
      />
    </div>
  )
}
