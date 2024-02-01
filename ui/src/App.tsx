import {useEffect, useRef} from 'react'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>()

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  useEffect(() => {
    draw()
  }, [])

  return (
    <div>
      <canvas
        className="w-screen h-screen"
        ref={(element) => {
          if (element) canvasRef.current = element
        }}
      />
    </div>
  )
}

export default App
