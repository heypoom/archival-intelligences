import {AutomationCue} from '../../constants/exhibition-cues'
import {automator} from './exhibition-automator'

const PREGEN_VERSION_ID = 1
const MAX_VARIANT_COUNT = 30

// Store used variants to ensure randomization without repeats
const usedVariants = new Set<string>()

function getRandomVariant(cueId: string): number {
  const maxAttempts = MAX_VARIANT_COUNT * 2 // Prevent infinite loops
  let attempts = 0
  
  while (attempts < maxAttempts) {
    const variant = Math.floor(Math.random() * MAX_VARIANT_COUNT) + 1
    const variantKey = `${cueId}_${variant}`
    
    if (!usedVariants.has(variantKey)) {
      usedVariants.add(variantKey)
      return variant
    }
    
    attempts++
  }
  
  // Fallback: clear used variants and return random
  console.warn('[offline-replay] Cleared variant cache to avoid conflicts')
  usedVariants.clear()
  const variant = Math.floor(Math.random() * MAX_VARIANT_COUNT) + 1
  usedVariants.add(`${cueId}_${variant}`)
  return variant
}

export function generateOfflineImagePath(cue: AutomationCue): string {
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
  
  const variant = getRandomVariant(cueId)
  
  return `https://images.poom.dev/foigoi/${PREGEN_VERSION_ID}/cues/${cueId}/${variant}/final.png`
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

export async function loadOfflineImage(imagePath: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    
    img.onload = () => {
      resolve(imagePath)
    }
    
    img.onerror = () => {
      console.warn(`[offline-replay] Image not found: ${imagePath}`)
      resolve(createBlackBackgroundDataUrl())
    }
    
    img.src = imagePath
  })
}

export function resetVariantCache(): void {
  usedVariants.clear()
  console.log('[offline-replay] Variant cache reset')
}