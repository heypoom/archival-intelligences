import {AutomationCue} from '../../constants/exhibition-cues'
import {automator} from './exhibition-automator'
import {$timestep, $startTimestep} from '../../store/progress'

const PROJ_ID = 'foigoi'
const PREGEN_VERSION_ID = 1
const MAX_VARIANT_COUNT = 30
const TOTAL_INFERENCE_STEPS = 10 // 0.png through 9.png
const MIN_DELAY = 2000 // 2 seconds
const MAX_DELAY = 2000 // Additional 2 seconds (total range 2-4s)

function getRandomVariant(): number {
  return Math.floor(Math.random() * MAX_VARIANT_COUNT)
}

export function generateOfflineImagePath(
  cue: AutomationCue,
  variantId: number,
  step: number
): string {
  const allCueIndex = automator.cues.indexOf(cue)
  const cueSuffix = `${allCueIndex}_${cue.time.replace(/[:.]/g, '_')}`

  let cueId: string
  if (cue.action === 'transcript') {
    cueId = `transcript_${cueSuffix}`
  } else if (cue.action === 'prompt') {
    cueId = `prompt_${cueSuffix}`
  } else {
    return ''
  }

  // For prompt cues, support preview steps (0-9.png) and final.png
  // For transcript cues, only final.png is available
  let fileName: string
  if (cue.action === 'prompt' && step >= 0 && step <= 9) {
    fileName = `${step}.png`
  } else {
    fileName = 'final.png'
  }

  return `https://images.poom.dev/${PROJ_ID}/${PREGEN_VERSION_ID}/cues/${cueId}/${variantId}/${fileName}`
}

export function shouldHandleOfflineGeneration(cue: AutomationCue): boolean {
  // Handle transcript cues with generation enabled
  if (cue.action === 'transcript' && cue.generate) {
    return true
  }

  // Handle prompt cues with generation enabled
  if (cue.action === 'prompt') {
    // Skip if no prompt or commit is false
    if (!cue.prompt || cue.commit === false) {
      return false
    }

    // Skip P2/P2B programs (Malaya image-to-image)
    if (cue.program.startsWith('P2')) {
      return false
    }

    // Skip P3/P3B programs (LoRA compatibility)
    if (cue.program.startsWith('P3')) {
      return false
    }

    return true
  }

  return false
}

export function createBlackBackgroundDataUrl(): string {
  // Create a 1x1 black pixel as data URL
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 1, 1)
  }
  return canvas.toDataURL()
}

export async function loadOfflineImage(
  imagePath: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()

    img.onload = () => {
      resolve(imagePath)
    }

    img.onerror = () => {
      resolve(null)
    }

    img.src = imagePath
  })
}

export async function simulateStepByStepInference(
  cue: AutomationCue,
  onStepUpdate: (
    imageUrl: string | null,
    step: number,
    isComplete: boolean
  ) => void
): Promise<void> {
  const variantId = getRandomVariant()

  // For transcript cues, only show final image directly
  if (cue.action === 'transcript') {
    const finalImagePath = generateOfflineImagePath(cue, variantId, -1)
    const loadedImageUrl = await loadOfflineImage(finalImagePath)

    onStepUpdate(loadedImageUrl, -1, true)
    return
  }

  // For prompt cues, show step-by-step inference (0.png through 9.png)
  if (cue.action === 'prompt') {
    // Set initial timestep
    $startTimestep.set(0)
    $timestep.set(0)

    for (let step = 0; step < TOTAL_INFERENCE_STEPS; step++) {
      // Update timestep
      $timestep.set(step)

      // Generate image path for this step
      const stepImagePath = generateOfflineImagePath(cue, variantId, step)
      const loadedImageUrl = await loadOfflineImage(stepImagePath)

      // Update the image
      onStepUpdate(loadedImageUrl, step, false)

      // Random delay between 2-4 seconds for next step
      if (step < TOTAL_INFERENCE_STEPS - 1) {
        const delay = MIN_DELAY + Math.random() * MAX_DELAY // 2s to 4s
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // Show final image
    const finalImagePath = generateOfflineImagePath(cue, variantId, -1)
    const finalImageUrl = await loadOfflineImage(finalImagePath)
    onStepUpdate(finalImageUrl, -1, true)
  }
}
