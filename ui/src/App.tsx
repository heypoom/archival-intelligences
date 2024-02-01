import {useEffect, useRef} from 'react'

import {DictationCaption, DictationTrigger, DictationLogs} from './dictation'

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
      <div className="fixed w-full flex left-0 justify-center pt-12">
        <DictationCaption />
      </div>

      <div className="fixed right-3 bottom-3">
        <DictationTrigger />
      </div>

      <div className="fixed left-3 bottom-3">
        <DictationLogs />
      </div>

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
