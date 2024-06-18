import {useEffect, useRef} from 'react'

import {paintDenseNoise} from '../utils/noise'
import {useMatchRoute} from '@tanstack/react-router'

export const AnimatedNoise = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const mr = useMatchRoute()
  const isSpeechRoute = mr({to: '/'})

  function paint() {
    const canvas = canvasRef.current
    if (!canvas) return

    paintDenseNoise(canvas)
  }

  useEffect(() => {
    const timer = setInterval(() => {
      paint()
    }, 400)

    return () => {
      clearInterval(timer)
    }
  }, [])

  if (isSpeechRoute) return null

  return (
    <div
      className="z-0 fixed w-screen h-screen top-0 left-0"
      style={{filter: 'blur(8px) brightness(50%)'}}
    >
      <canvas ref={canvasRef} className="w-screen h-screen" />
    </div>
  )
}
