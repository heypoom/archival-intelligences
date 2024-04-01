import { ReactNode, useEffect, useRef } from 'react'

const BLOCK_SIZE = 2
const SCALE_BY = 2

const currentNoise: number[][] = []

interface Props {
  children?: ReactNode
}

export const AnimatedNoise = (props: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function paint() {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const screenWidth = window.innerWidth
    const screenHeight = window.innerHeight

    const gridWidth = Math.floor(screenWidth / SCALE_BY / BLOCK_SIZE)
    const gridHeight = Math.floor(screenHeight / SCALE_BY / BLOCK_SIZE)

    canvas.width = gridWidth * BLOCK_SIZE
    canvas.height = gridHeight * BLOCK_SIZE

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const v = Math.floor(Math.random() * 255)

        if (!currentNoise[y]) currentNoise[y] = []
        currentNoise[y][x] = v

        ctx.fillStyle = `rgb(${v}, ${v}, ${v})`
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
      }
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      paint()
    }, 200)

    return () => {
      clearInterval(timer)
    }
  }, [])

  return (
    <div>
      {props.children}

      <canvas ref={canvasRef} className='w-screen h-screen' />
    </div>
  )
}
