import { useEffect, useRef } from 'react'
import { paintDenseNoise, paintNoiseGrid } from '../utils/noise.ts'

export const AnimatedNoise = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function paint() {
    const canvas = canvasRef.current
    if (!canvas) return

    paintNoiseGrid(canvas, { scaleBy: 1, blockSize: 7 })
    // paintDenseNoise(canvas)
  }

  useEffect(() => {
    const timer = setInterval(() => {
      paint()
    }, 80)

    return () => {
      clearInterval(timer)
    }
  }, [])

  return (
    <div>
      <canvas ref={canvasRef} className='w-screen h-screen' />
    </div>
  )
}
