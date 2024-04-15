import { useEffect, useRef } from 'react'
import { $guidance } from '../store/guidance.ts'
import { paintDenseNoise, paintNoiseGrid } from '../utils/noise.ts'

export const AnimatedNoise = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function paint() {
    const canvas = canvasRef.current
    if (!canvas) return

    // const size = $guidance.get()

    // if (size < 2) {
    paintDenseNoise(canvas)
    // } else {
    //   paintNoiseGrid(canvas, { scaleBy: 1, blockSize: size })
    // }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      paint()
    }, 400)

    return () => {
      clearInterval(timer)
    }
  }, [])

  //

  return (
    <div style={{ filter: 'blur(8px) brightness(50%)' }} className='z-0'>
      <canvas ref={canvasRef} className='w-screen h-screen' />
    </div>
  )
}
