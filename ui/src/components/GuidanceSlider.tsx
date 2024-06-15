import Slider from '@mui/joy/Slider'
import {useStore} from '@nanostores/react'

import {$guidance} from '../store/guidance'
import {$generating} from '../store/prompt'

interface Props {
  onChange?: (value: number) => void
}

export const GuidanceSlider = (props: Props) => {
  const {onChange} = props

  const guidance = useStore($guidance)
  const generating = useStore($generating)

  return (
    <div className="w-full min-w-[350px]">
      <Slider
        value={guidance}
        onChange={(_, value) => {
          if (typeof value === 'number') {
            $guidance.set(value)
          }
        }}
        onChangeCommitted={(_, value) => {
          if (typeof value === 'number' && onChange) {
            onChange(value)
          }
        }}
        min={0}
        defaultValue={50}
        max={100}
        variant="soft"
        color="neutral"
        disabled={generating}
      />
    </div>
  )
}
