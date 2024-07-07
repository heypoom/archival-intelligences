import cx from 'classnames'

import {useStore} from '@nanostores/react'

import {GuidanceSlider} from './GuidanceSlider'
import {PromptInput} from './PromptInput'

import {$generating, $inferencePreview, $prompt} from '../store/prompt'

import {$guidance} from '../store/guidance'

import {useCrossFade} from '../hooks/useCrossFade'

import {startInference} from '../utils/inference'
import {$imageFadingOut} from '../store/fader'
import {
  onGuidanceCommitted,
  onPromptCommitted,
  onPromptKeyChangeStart,
} from '../utils/prompt-manager'

const MIN_KEYWORD_TRIGGER = 2

interface Props {
  keyword?: string
  command: string
  regenerate?: true | string
}

export function PromptManager(props: Props) {
  const {keyword, command} = props

  const prompt = useStore($prompt)
  const isGenerating = useStore($generating)
  const guidance = useStore($guidance)
  const previewUrl = useStore($inferencePreview)

  const isFadingOut = useStore($imageFadingOut)
  const {crossfading, prevUrl} = useCrossFade(previewUrl, true)

  const useKeyword = typeof keyword === 'string' && keyword.length > 0

  async function handleChange(input: string) {
    $prompt.set(input)

    onPromptKeyChangeStart()

    const trimmedInput = input.trim().toLowerCase()

    if (useKeyword) {
      const isKeyword = trimmedInput.endsWith(keyword.toLowerCase())
      const segments = input.split(' ')

      if (isKeyword && segments.length > MIN_KEYWORD_TRIGGER) {
        onPromptCommitted({input, command, guidance})
      }
    }
  }

  async function handleGuidanceChange(value: number) {
    if (useKeyword) {
      const isKeyword = prompt
        .trim()
        .toLowerCase()
        .endsWith(keyword.toLowerCase())

      const segments = prompt.split(' ')

      // if the keyword is not present or the prompt is too short
      if (!isKeyword || segments.length <= MIN_KEYWORD_TRIGGER) {
        return
      }
    }

    const validCommands = ['P2', 'P2B']

    if (!validCommands.includes(command)) {
      return
    }

    onGuidanceCommitted({command, value})
  }

  const fading = crossfading && !isGenerating

  const mainImage = fading ? prevUrl : previewUrl
  const fadeImage = fading ? previewUrl : ''

  return (
    <div className="flex min-h-screen">
      <div className="fixed w-screen h-screen bg-transparent z-30 top-0 left-0">
        <div className="flex flex-col items-center justify-center w-full h-full bg-transparent">
          <PromptInput
            input={{
              disabled: isGenerating,
              onChange: (e) => handleChange(e.target.value),
              value: prompt,
              onKeyDown: (e) => {
                // freestyle inference
                if (e.key === 'Enter' && !useKeyword) {
                  startInference({
                    command,
                    regenerate: props.regenerate,
                  })
                }
              },
            }}
          />

          <div className="pt-4">
            <GuidanceSlider onChange={handleGuidanceChange} />
          </div>
        </div>
      </div>

      <div className="fixed flex items-center justify-center w-full h-full z-[1]">
        <div className="relative flex items-center justify-center w-full h-full">
          <img
            src={mainImage}
            alt=""
            className={cx(
              'absolute h-screen object-cover object-center transition-opacity ease-in-out pointer-events-none select-none z-[1]',
              isFadingOut ? 'duration-[2s]' : 'duration-[3s]',
              mainImage && !isFadingOut && 'opacity-100',
              (!mainImage || isFadingOut) && 'opacity-0'
            )}
          />

          <img
            src={fadeImage}
            alt=""
            className={cx(
              'absolute h-screen object-cover object-center transition-opacity ease-in-out pointer-events-none select-none z-[10]',
              isFadingOut ? 'duration-[2s]' : 'duration-[3s]',
              fadeImage && !isFadingOut && 'opacity-100',
              (!fadeImage || isFadingOut) && 'opacity-0'
            )}
          />
        </div>
      </div>
    </div>
  )
}
