import {AutomationCue} from '../../constants/exhibition-cues'
import {automator} from './exhibition-automator'
import {$timestep, $startTimestep} from '../../store/progress'
import {$regenCount, $regenActive, $regenEnabled} from '../../store/regen'

const PROJ_ID = 'foigoi'
const PREGEN_VERSION_ID = 2
const TRANSCRIPT_MAX_VARIANT_COUNT = 30 // Program 0 transcript cues
const PROMPT_MAX_VARIANT_COUNT = 50 // Other programs (prompt and move-slider actions)

const DEFAULT_PREVIEW_STEPS = 40

// Program-specific inference steps for preview images (0.png through N.png)
// P2: 29 steps, P3/P4: 40 steps, P0: 40 steps (but no preview shown)
const PROGRAM_PREVIEW_STEPS: Record<string, number> = {
  P2: 29, // malaya.py P2 uses 50 steps
  P2B: 29, // malaya.py P2B uses 50 steps
  P3: DEFAULT_PREVIEW_STEPS, // text_to_image.py P3 uses 40 steps
  P3B: DEFAULT_PREVIEW_STEPS, // text_to_image.py P3B uses 40 steps
  P4: DEFAULT_PREVIEW_STEPS, // text_to_image.py P4 uses 40 steps
}

const MIN_DELAY = 2000 // 2 seconds
const MAX_DELAY = 2000 // Additional 2 seconds (total range 2-4s)

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

export function getPreviewStepsForCue(cue: AutomationCue): number {
  if (cue.action === 'prompt' && cue.program) {
    return PROGRAM_PREVIEW_STEPS[cue.program] ?? DEFAULT_PREVIEW_STEPS
  }

  if (cue.action === 'move-slider' && cue.program) {
    // if the strength is 0, it only use 1 step as there is no change needed.
    if (cue.value === 0) {
      return 1
    }

    return PROGRAM_PREVIEW_STEPS[cue.program] ?? DEFAULT_PREVIEW_STEPS
  }

  return DEFAULT_PREVIEW_STEPS
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

  // For transcript and slider cues, only show final image directly
  if (cue.action === 'transcript' || cue.action === 'move-slider') {
    const finalImagePath = generateOfflineImagePath(cue, variantId, -1)
    const loadedImageUrl = await loadOfflineImage(finalImagePath)

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

      // Generate image path for this step
      const stepImagePath = generateOfflineImagePath(cue, variantId, step)
      const loadedImageUrl = await loadOfflineImage(stepImagePath)

      // Update the image
      onStepUpdate(loadedImageUrl, step, false)

      // Random delay between 2-4 seconds for next step
      if (step < totalSteps - 1) {
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
