import Slider from '@mui/joy/Slider'

export const GuidanceSlider = () => {
  return (
    <div className='w-full min-w-[350px]'>
      <Slider
        min={0}
        defaultValue={50}
        max={100}
        variant='soft'
        color='neutral'
      />
    </div>
  )
}
