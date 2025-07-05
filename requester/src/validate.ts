import PQueue from 'p-queue'
import _cues from '../data/cues.json'
import type {AutomationCue} from './types'
import {RedisClient} from 'bun'

const cues = _cues as AutomationCue[]

const CONCURRENT_REQUESTS = 10
const MAX_VARIANT_COUNT = 10
const PREGEN_VERSION_ID = 1

const VALKEY_URL = 'redis://raya.poom.dev:6379'

// Set by text_to_image.py when uploading images
const PREGEN_UPLOAD_STATUS_KEY = `pregen/${PREGEN_VERSION_ID}/variant_upload_status`

interface ValidationResult {
  url: string
  cue_id: string
  variant_id: number
  exists: boolean
}

class ImageValidator {
  private queue: PQueue
  private vk: RedisClient

  constructor() {
    this.queue = new PQueue({concurrency: CONCURRENT_REQUESTS})
    this.vk = new RedisClient(VALKEY_URL)
  }

  async init() {
    console.log('Initializing Image Validator...')
    console.log(`Concurrent requests: ${CONCURRENT_REQUESTS}`)
    console.log(`Max variant count: ${MAX_VARIANT_COUNT}`)
    console.log(`Pregen version ID: ${PREGEN_VERSION_ID}`)
  }

  async checkImageExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {method: 'HEAD'})
      return response.ok
    } catch (error) {
      return false
    }
  }

  async validateImage(
    cue_id: string,
    variant_id: number
  ): Promise<ValidationResult> {
    const url = `https://images.poom.dev/foigoi/${PREGEN_VERSION_ID}/cues/${cue_id}/${variant_id}/final.png`

    const exists = await this.checkImageExists(url)

    if (exists) {
      console.log(
        `✅ Image exists: ${url} (CUE_ID: ${cue_id}, VARIANT_ID: ${variant_id})`
      )

      // Mark whether the upload was successful in Valkey
      await this.vk.hmset(PREGEN_UPLOAD_STATUS_KEY, [
        `${cue_id}_${variant_id}`,
        'true',
      ])
    } else {
      console.warn(
        `❌ Image missing: ${url} (CUE_ID: ${cue_id}, VARIANT_ID: ${variant_id})`
      )

      // Mark that the upload was not successful in Valkey
      await this.vk.hmset(PREGEN_UPLOAD_STATUS_KEY, [
        `${cue_id}_${variant_id}`,
        'false',
      ])
    }

    return {
      url,
      cue_id,
      variant_id,
      exists,
    }
  }

  async validateTranscriptCues(): Promise<ValidationResult[]> {
    console.log('Validating transcript cues...')

    const transcriptCuesToValidate = cues.filter(
      (cue) => cue.action === 'transcript' && cue.generate
    )

    console.log(
      `Found ${transcriptCuesToValidate.length} transcript cues to validate`
    )

    if (transcriptCuesToValidate.length === 0) {
      console.log('No transcript cues to validate')
      return []
    }

    const allValidations: Promise<ValidationResult>[] = []

    for (const cue of transcriptCuesToValidate) {
      if (cue.action === 'transcript' && cue.transcript) {
        const cueIndex = cues.indexOf(cue)
        const cue_id = `transcript_${cueIndex}_${cue.time.replace(
          /[:.]/g,
          '_'
        )}`

        // Check all possible variant IDs (1 to MAX_VARIANT_COUNT)
        for (
          let variant_id = 1;
          variant_id <= MAX_VARIANT_COUNT;
          variant_id++
        ) {
          allValidations.push(
            this.queue.add(() =>
              this.validateImage(cue_id, variant_id)
            ) as Promise<ValidationResult>
          )
        }
      }
    }

    console.log(`Queuing ${allValidations.length} validation requests...`)

    const results = await Promise.all(allValidations)
    return results
  }

  async validateImageGenerationCues(): Promise<ValidationResult[]> {
    console.log('Validating image generation cues...')

    const imageGenerationCues = cues.filter((cue) => cue.action === 'prompt')

    console.log(`Found ${imageGenerationCues.length} image generation cues`)

    if (imageGenerationCues.length === 0) {
      console.log('No image generation cues to validate')
      return []
    }

    const allValidations: Promise<ValidationResult>[] = []

    for (const cue of imageGenerationCues) {
      if (cue.action === 'prompt' && cue.prompt) {
        const cueIndex = cues.indexOf(cue)
        const cue_id = `prompt_${cueIndex}_${cue.time.replace(/[:.]/g, '_')}`

        // For prompt cues, assuming single variant (variant_id = 1)
        allValidations.push(
          this.queue.add(() =>
            this.validateImage(cue_id, 1)
          ) as Promise<ValidationResult>
        )
      }
    }

    console.log(`Queuing ${allValidations.length} validation requests...`)

    const results = await Promise.all(allValidations)
    return results
  }

  printMissingImages(results: ValidationResult[]): void {
    const missingImages = results.filter((result) => !result.exists)

    if (missingImages.length === 0) {
      console.log('✅ All images exist!')
      return
    }

    console.log(`\n❌ Found ${missingImages.length} missing images:`)
    console.log('URL | CUE_ID | VARIANT_ID')
    console.log('--- | ------ | ----------')

    for (const missing of missingImages) {
      console.log(`${missing.url} | ${missing.cue_id} | ${missing.variant_id}`)
    }
  }

  async run(): Promise<void> {
    await this.init()

    console.log('=== Image Validation Report ===')

    // Validate transcript cues
    const transcriptResults = await this.validateTranscriptCues()

    // Validate image generation cues
    const imageResults = await this.validateImageGenerationCues()

    // Combine results
    const allResults = [...transcriptResults, ...imageResults]

    const existingCount = allResults.filter((r) => r.exists).length
    const totalCount = allResults.length

    console.log(`\n=== Summary ===`)
    console.log(`Total images checked: ${totalCount}`)
    console.log(`Existing images: ${existingCount}`)
    console.log(`Missing images: ${totalCount - existingCount}`)

    // Print missing images
    this.printMissingImages(allResults)

    console.log('\n✅ Validation complete')
  }
}

// Run the script
const validator = new ImageValidator()
await validator.run()
