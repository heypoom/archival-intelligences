import {AutomationCue} from '../../constants/exhibition-cues'
import {automator} from './exhibition-automator'
import {$timestep, $startTimestep} from '../../store/progress'
import {$regenCount, $regenActive, $regenEnabled} from '../../store/regen'

// Project ID for image path
const PROJ_ID = 'foigoi'

// Which version of pre-generated images to use
const PREGEN_VERSION_ID = 2

// Program 0 transcript cues
const TRANSCRIPT_MAX_VARIANT_COUNT = 30

// Other programs (prompt and move-slider actions)
const PROMPT_MAX_VARIANT_COUNT = 50

const V1_DEFAULT_PREVIEW_STEPS = 10
const V2_DEFAULT_PREVIEW_STEPS = 40

// Minimum and maximum delay for each step
const MIN_DELAY = 750
const MAX_DELAY = 1800

// Regeneration timing constants (from regen.ts)
const BASE_DELAY = 30 * 1000 // 30 seconds
const INCREMENTAL_DELAY = BASE_DELAY // 30 seconds
const BASE_GENERATION = 6

// Track active regeneration
let regenerationTimer: number | null = null
let currentRegenerationCue: AutomationCue | null = null

function getRandomVariant(
  actionType: 'transcript' | 'prompt' | 'move-slider'
): number {
  const maxCount =
    actionType === 'transcript'
      ? TRANSCRIPT_MAX_VARIANT_COUNT
      : PROMPT_MAX_VARIANT_COUNT
  return 1 + Math.floor(Math.random() * maxCount)
}

export function getPreviewStepsForCue(
  cue: AutomationCue,
  pregenVersionId = PREGEN_VERSION_ID
): number {
  // override inference step if defined in the cue
  if (
    (cue.action === 'prompt' || cue.action === 'move-slider') &&
    cue.program
  ) {
    if (cue.inferenceStep !== undefined) {
      return cue.inferenceStep
    }
  }

  if (pregenVersionId === 1) {
    return V1_DEFAULT_PREVIEW_STEPS
  }

  return V2_DEFAULT_PREVIEW_STEPS
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
  } else if (cue.action === 'move-slider') {
    cueId = `slider_${cueSuffix}_val${cue.value}`
  } else {
    return ''
  }

  // For prompt cues, support preview steps (0-N.png) and final.png
  // For transcript and slider cues, only final.png is available
  let fileName: string
  if (cue.action === 'prompt' && step >= 0) {
    const maxStep = getPreviewStepsForCue(cue) - 1

    if (step <= maxStep) {
      fileName = `${step}.png`
    } else {
      fileName = 'final.png'
    }
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

    return true
  }

  // Handle slider cues with generation enabled
  if (cue.action === 'move-slider') {
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
  const variantId = getRandomVariant(
    cue.action === 'transcript'
      ? 'transcript'
      : cue.action === 'move-slider'
        ? 'move-slider'
        : 'prompt'
  )

  const isZeroStrengthImage = cue.action === 'move-slider' && cue.value === 0

  // For transcript and slider cues, only show final image directly
  if (cue.action === 'transcript' || cue.action === 'move-slider') {
    const finalImagePath = generateOfflineImagePath(cue, variantId, -1)
    const loadedImageUrl = await loadOfflineImage(finalImagePath)

    // For strength=0, show immediately since it's the same image
    if (!isZeroStrengthImage) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    onStepUpdate(loadedImageUrl, -1, true)
    return
  }

  // For prompt cues, show step-by-step inference (0.png through N.png)
  if (cue.action === 'prompt') {
    const totalSteps = getPreviewStepsForCue(cue)

    // Set initial timestep
    $startTimestep.set(0)
    $timestep.set(0)

    for (let step = 0; step < totalSteps; step++) {
      // Update timestep
      $timestep.set(step)

      const stepImagePath = generateOfflineImagePath(cue, variantId, step)

      const loadedImageUrl = await loadOfflineImage(stepImagePath)

      // Update the image
      onStepUpdate(loadedImageUrl, step, false)

      if (step < totalSteps - 1) {
        const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)

        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // Show final image
    const finalImagePath = generateOfflineImagePath(cue, variantId, -1)
    const finalImageUrl = await loadOfflineImage(finalImagePath)
    onStepUpdate(finalImageUrl, -1, true)
  }
}

/**
 * Calculate regeneration delay based on current regen count
 * Matches the delay logic from ui/src/store/regen.ts
 */
function calculateRegenerationDelay(): number {
  const gen = $regenCount.get()
  let delay = BASE_DELAY

  if (gen > BASE_GENERATION) {
    delay += (gen - BASE_GENERATION) * INCREMENTAL_DELAY
  }

  return delay
}

/**
 * Check if regeneration should continue by monitoring current cue changes
 */
function shouldContinueRegeneration(originalCue: AutomationCue): boolean {
  return currentRegenerationCue === originalCue && $regenActive.get()
}

/**
 * Start offline continuous regeneration for Program B cues
 */
export async function startOfflineRegeneration(
  cue: AutomationCue,
  onStepUpdate: (
    imageUrl: string | null,
    step: number,
    isComplete: boolean
  ) => void
): Promise<void> {
  // Stop any existing regeneration
  abortOfflineRegeneration()

  // Set up regeneration state
  currentRegenerationCue = cue
  $regenEnabled.set(true)
  $regenActive.set(true)
  $regenCount.set(0)

  console.log(
    `[offline-regen] Starting continuous regeneration for: ${cue.action}`
  )

  // Start the regeneration cycle
  await performRegenerationCycle(cue, onStepUpdate)
}

/**
 * Perform a single regeneration cycle and schedule the next one
 */
async function performRegenerationCycle(
  cue: AutomationCue,
  onStepUpdate: (
    imageUrl: string | null,
    step: number,
    isComplete: boolean
  ) => void
): Promise<void> {
  if (!shouldContinueRegeneration(cue)) {
    return
  }

  // Perform the inference simulation
  await simulateStepByStepInference(cue, onStepUpdate)

  if (!shouldContinueRegeneration(cue)) {
    return
  }

  // Increment regen count
  const currentCount = $regenCount.get()
  $regenCount.set(currentCount + 1)

  // Calculate delay for next regeneration
  const delay = calculateRegenerationDelay()

  console.log(
    `[offline-regen] Next regeneration in ${delay}ms (count: ${currentCount + 1})`
  )

  // Schedule next regeneration
  regenerationTimer = window.setTimeout(async () => {
    if (shouldContinueRegeneration(cue)) {
      await performRegenerationCycle(cue, onStepUpdate)
    }
  }, delay)
}

/**
 * Abort ongoing offline regeneration
 */
export function abortOfflineRegeneration(): void {
  if (regenerationTimer !== null) {
    clearTimeout(regenerationTimer)
    regenerationTimer = null
  }

  if (currentRegenerationCue !== null) {
    console.log(
      `[offline-regen] Aborting regeneration for: ${currentRegenerationCue.action}`
    )

    currentRegenerationCue = null
  }

  $regenCount.set(0)
  $regenActive.set(false)
}

/**
 * Check if a cue should trigger continuous regeneration
 */
export function shouldStartRegeneration(cue: AutomationCue): boolean {
  return cue.action === 'prompt' && cue.enter?.regen === true
}
