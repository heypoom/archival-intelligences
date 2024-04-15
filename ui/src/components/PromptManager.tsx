import { GuidanceSlider } from './GuidanceSlider'
import { PromptInput } from './PromptInput'
import { useStore } from '@nanostores/react'
import { $generating, $prompt } from '../store/prompt'
import { $guidance } from '../store/guidance'

interface Props {
  keyword: string
}

export function PromptManager(props: Props) {
  const { keyword } = props

  const prompt = useStore($prompt)
  const isGenerating = useStore($generating)
  const guidance = useStore($guidance)

  function handleChange(input: string) {
    $prompt.set(input)

    const segments = input.toLowerCase().split(' ')
    const last = segments[segments.length - 1]

    if (last === keyword && segments.length > 2) {
      console.log(`generating prompt "${prompt}" with guidance ${guidance}`)
      $generating.set(true)
    }
  }

  function handleGuidanceChange(value: number) {
    console.log(`regenerating with guidance ${value}`)
  }

  return (
    <div className='flex'>
      <div className='fixed w-screen h-screen'>
        <div className='flex flex-col items-center justify-center w-full h-full'>
          <PromptInput
            input={{
              disabled: isGenerating,
              onChange: e => handleChange(e.target.value),
              value: prompt,
            }}
          />

          <div className='pt-4'>
            <GuidanceSlider onChange={handleGuidanceChange} />
          </div>

          <div>
            {prompt} / {guidance}
          </div>
        </div>
      </div>
    </div>
  )
}
