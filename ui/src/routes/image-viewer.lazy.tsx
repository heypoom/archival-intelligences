import {createLazyFileRoute} from '@tanstack/react-router'
import {useState, useEffect, useCallback} from 'react'
import {automator} from '../utils/exhibition/exhibition-automator'

export const Route = createLazyFileRoute('/image-viewer')({
  component: ImageViewer,
})

const versionId = 1 // static pregen version ID

function ImageViewer() {
  // Filter transcript cues that have generation enabled
  const transcriptCues = automator.cues.filter(
    (cue) => cue.action === 'transcript' && cue.generate
  )

  const [cueIndex, setCueIndex] = useState(0)
  const [variantIndex, setVariantIndex] = useState(1) // 1-10
  const [imageError, setImageError] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const currentCue = transcriptCues[cueIndex]
  const totalCues = transcriptCues.length

  // Generate image path based on generate.ts logic
  const generateImagePath = useCallback((cue: any, variant: number) => {
    const allCueIndex = automator.cues.indexOf(cue)
    const cueId = `transcript_${allCueIndex}_${cue.time.replace(/[:.]/g, '_')}`
    return `https://images.poom.dev/foigoi/${versionId}/cues/${cueId}/${variant}/final.png`
  }, [])

  const currentImagePath = currentCue
    ? generateImagePath(currentCue, variantIndex)
    : ''

  // Poll until automator is ready
  useEffect(() => {
    let timeout: number = 0

    const checkReady = () => {
      if (automator.loaded) {
        clearTimeout(timeout)
        setIsReady(true)
      } else {
        timeout = setTimeout(checkReady, 100) // Check every 100ms
      }
    }

    checkReady()

    return () => clearTimeout(timeout)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setCueIndex((prev) => (prev > 0 ? prev - 1 : totalCues - 1))
          setImageError(false)
          break
        case 'ArrowRight':
          e.preventDefault()
          setCueIndex((prev) => (prev < totalCues - 1 ? prev + 1 : 0))
          setImageError(false)
          break
        case 'ArrowUp':
          e.preventDefault()
          setVariantIndex((prev) => (prev < 10 ? prev + 1 : 1))
          setImageError(false)
          break
        case 'ArrowDown':
          e.preventDefault()
          setVariantIndex((prev) => (prev > 1 ? prev - 1 : 10))
          setImageError(false)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [totalCues])

  // Reset image error when image changes
  useEffect(() => {
    setImageError(false)
  }, [currentImagePath])

  // If not ready, show loading state
  if (!isReady) {
    return <div className="min-h-screen bg-[#424242]" />
  }

  if (currentCue === undefined || currentCue === null) {
    return (
      <div className="min-h-screen bg-[#424242] flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl mb-4">
            No transcript cues with generation found
          </h1>
          <p>Check exhibition-cues.ts for cues with generate: true</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#424242] text-white relative">
      {/* Image Display */}
      <div className="flex items-center justify-center min-h-screen">
        {imageError ? (
          <div className="border-2 border-gray-600 border-dashed rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">🖼️</div>
            <div className="text-xl mb-2">Missing Image</div>
            <div className="text-sm text-gray-400 font-mono break-all">
              {currentImagePath}
            </div>
          </div>
        ) : (
          <img
            src={currentImagePath}
            alt={`Cue ${cueIndex} Variant ${variantIndex}`}
            className="w-full h-full min-h-[100vh] object-cover"
            onError={() => setImageError(true)}
          />
        )}
      </div>

      {/* Metadata Overlay */}
      <div className="absolute top-4 left-4 bg-black/70 rounded p-4 font-mono text-sm">
        <div className="mb-2">
          <span className="text-gray-400">Cue:</span> {cueIndex + 1}/{totalCues}
        </div>
        <div className="mb-2">
          <span className="text-gray-400">Time:</span> {currentCue.time}
        </div>
        <div className="mb-2">
          <span className="text-gray-400">Variant:</span> {variantIndex}/10
        </div>
        <div className="mb-2">
          <span className="text-gray-400">Program:</span> P0
        </div>
        <div className="max-w-md">
          <span className="text-gray-400">Prompt:</span>{' '}
          <span className="break-words">
            {currentCue.action === 'transcript' ? currentCue.transcript : 'N/A'}
          </span>
        </div>
      </div>

      {/* Keyboard Guide */}
      <div className="absolute top-4 right-4 bg-black/70 rounded p-4 font-mono text-sm">
        <div className="text-gray-400 mb-2">Navigation:</div>
        <div>← → Change cue</div>
        <div>↑ ↓ Change variant</div>
      </div>
    </div>
  )
}
