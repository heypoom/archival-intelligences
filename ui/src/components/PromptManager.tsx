import cx from 'classnames'
import {useEffect, useState} from 'react'
import {useStore} from '@nanostores/react'

import {GuidanceSlider} from './GuidanceSlider'
import {PromptInput} from './PromptInput'

import {
  $apiReady,
  $generating,
  $inferencePreview,
  $prompt,
} from '../store/prompt'

import {$guidance} from '../store/guidance'
import {socket} from '../manager/socket.ts'

import {useCrossFade} from '../hooks/useCrossFade.tsx'

import {regenerate, cleanupRegenerate, disableRegen} from '../store/regen.ts'

const MIN_KEYWORD_TRIGGER = 2
const FADE_OUT_DURATION = 2000

interface Props {
  keyword?: string
  command: string
  regenerate?: true | string
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function PromptManager(props: Props) {
  const {keyword, command} = props

  const prompt = useStore($prompt)
  const isGenerating = useStore($generating)
  const guidance = useStore($guidance)
  const previewUrl = useStore($inferencePreview)
  const apiReady = useStore($apiReady)

  const [isFadingOut, setFadingOut] = useState(false)
  const {crossfading, prevUrl} = useCrossFade(previewUrl, true)

  const useKeyword = typeof keyword === 'string' && keyword.length > 0

  async function fadeOutOldImage() {
    setFadingOut(true)

    // wait for the old image to fully fade out
    await delay(FADE_OUT_DURATION)

    setFadingOut(false)
    $inferencePreview.set('')
  }

  async function handleChange(input: string) {
    $prompt.set(input)

    // reset generation count if we're regenerating
    disableRegen('prompt change')

    if (previewUrl) {
      await fadeOutOldImage()
    }

    const trimmedInput = input.trim().toLowerCase()

    const shouldEnableRegeneration =
      typeof props.regenerate === 'string' &&
      trimmedInput.endsWith(props.regenerate.toLowerCase())

    // enable regeneration if the input ends with the regeneration keyword
    if (shouldEnableRegeneration) {
      regenerate(command, prompt, true)
    }

    if (useKeyword) {
      const isKeyword = trimmedInput.endsWith(keyword.toLowerCase())
      const segments = input.split(' ')

      if (isKeyword && segments.length > MIN_KEYWORD_TRIGGER) {
        console.log(
          `generating "${input}" with guidance ${guidance} -> ${command}`
        )

        $generating.set(true)

        if (!apiReady) {
          console.log('[!!!!] socket not ready')
          return
        }

        console.log(`[program] c=${command}, g=${guidance}`)

        if (command === 'P2') {
          socket.sock.send(`P2:${(guidance / 100).toFixed(2)}`)
        } else if (command === 'P2B') {
          socket.sock.send(`P2B:${(guidance / 100).toFixed(2)}`)
        } else if (command === 'P3B') {
          socket.sock.send(`P3B:${input}`)
        } else {
          socket.sock.send(command)
        }
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

    if (previewUrl) {
      await fadeOutOldImage()
    }

    $generating.set(true)

    if (command === 'P2') {
      socket.sock.send(`P2:${(value / 100).toFixed(2)}`)
    } else if (command === 'P2B') {
      socket.sock.send(`P2B:${(value / 100).toFixed(2)}`)
    }
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
                  if (!apiReady) {
                    console.log('[!!!!] socket not ready')
                    return
                  }

                  $generating.set(true)

                  const sys = `${command}:${prompt}`
                  console.log(`> sent "${sys}"`)

                  socket.sock.send(sys)

                  if (props.regenerate === true) {
                    regenerate(command, prompt, true)

                    console.log('[gen] freeform regeneration enabled')
                  }
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
