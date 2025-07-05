import {RedisClient} from 'bun'
import PQueue from 'p-queue'
import _cues from '../data/cues.json'
import type {AutomationCue} from './types'

const cues = _cues as AutomationCue[]

const MODAL_ENDPOINT =
  'https://heypoom--exhibition-pregen-text-to-image-endpoint.modal.run/generate'
const VALKEY_URL = 'redis://raya.poom.dev:6379'
const CONCURRENT_REQUESTS = 3

// generate up to 10 variations per cue :)
const MAX_VARIANT_COUNT = 10

const PREGEN_VERSION_ID = 1 // static pregen version ID

const REQUESTER_CUES_KEY = `requester/${PREGEN_VERSION_ID}/cues`
const REQUESTER_PROMPTS_KEY = `requester/${PREGEN_VERSION_ID}/prompts`
const REQUESTER_DURATIONS_KEY = `requester/${PREGEN_VERSION_ID}/durations`

// Set by text_to_image.py when uploading images
const PREGEN_UPLOAD_STATUS_KEY = `pregen/${PREGEN_VERSION_ID}/variant_upload_status`

interface GenerationRequest {
  cue_id: string
  prompt: string
  program_key: string
  variant_id: number
}

class GenerationRequester {
  private queue: PQueue
  private vk: RedisClient

  constructor() {
    this.queue = new PQueue({concurrency: CONCURRENT_REQUESTS})
    this.vk = new RedisClient(VALKEY_URL)
  }

  async init() {
    console.log('Initializing Generation Requester...')
    console.log(`Using Modal endpoint: ${MODAL_ENDPOINT}`)
    console.log(`Using Valkey at: ${VALKEY_URL}`)
    console.log(`Concurrent requests: ${CONCURRENT_REQUESTS}`)
  }

  async getProcessedCues(): Promise<Set<string>> {
    try {
      const processedCues = await this.vk.hgetall(REQUESTER_CUES_KEY)
      const cueIds = new Set(processedCues ? Object.keys(processedCues) : [])
      console.log(`Found ${cueIds.size} already processed cues in Valkey`)
      console.log(`Processed Cues:`, cueIds)

      return cueIds
    } catch (error) {
      console.warn('Failed to read processed cues from Valkey:', error)
      console.log('Assuming fresh start (no processed cues)')
      return new Set()
    }
  }

  async generateImage(request: GenerationRequest): Promise<void> {
    try {
      console.log(
        `Generating image for cue ${request.cue_id} with program ${request.program_key}`
      )

      const start = performance.now()

      const response = await fetch(MODAL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          program_key: request.program_key,
          cue_id: request.cue_id,
          variant_id: request.variant_id,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const output = await response.json()
      console.log(`Response for ${request.cue_id}:`, output)
      console.log(`✓ Generated image for cue ${request.cue_id}`)

      const duration = (performance.now() - start).toFixed(2)
      console.log(`Time taken: ${duration} ms`)

      // Mark as processed in Valkey
      await this.vk.hincrby(REQUESTER_CUES_KEY, request.cue_id, 1)

      // Log the prompt for reference
      await this.vk.hmset(REQUESTER_PROMPTS_KEY, [
        request.cue_id,
        request.prompt,
      ])

      // Log the durations for reference
      await this.vk.hmset(REQUESTER_DURATIONS_KEY, [request.cue_id, duration])
    } catch (error) {
      console.error(
        `Failed to generate image for cue ${request.cue_id}:`,
        error
      )
      throw error
    }
  }

  async processTranscriptCues(): Promise<void> {
    console.log('Processing transcript cues...')

    const processedCues = await this.getProcessedCues()

    const transcriptCuesToGenerate = cues.filter(
      (cue) => cue.action === 'transcript' && cue.generate
    )

    console.log(
      `Found ${transcriptCuesToGenerate.length} transcript cues to generate`
    )

    if (transcriptCuesToGenerate.length === 0) {
      console.log('No transcript cues to process')
      return
    }

    const allRequests: GenerationRequest[] = []
    let skippedCount = 0

    for (const cue of transcriptCuesToGenerate) {
      if (cue.action === 'transcript' && cue.transcript) {
        // Use the transcript as the prompt
        const prompt = cue.transcript

        // Generate a unique cue_id based on the cue's time or index
        const cueIndex = cues.indexOf(cue)
        const cue_id = `transcript_${cueIndex}_${cue.time.replace(
          /[:.]/g,
          '_'
        )}`

        // For transcript cues, we'll use P0 as default program
        const program_key = 'P0'

        // Generate multiple variants up to MAX_VARIANT_COUNT

        for (
          let variant_id = 1;
          variant_id <= MAX_VARIANT_COUNT;
          variant_id++
        ) {
          const [status] = await this.vk.hmget(PREGEN_UPLOAD_STATUS_KEY, [
            `${cue_id}_${variant_id}`,
          ])

          if (!status || status === 'false') {
            console.log(
              `📚 Queuing new image for cue=${cue_id}, variant=${variant_id}, prompt=${prompt}, vk_status=${status}`
            )

            allRequests.push({
              cue_id,
              prompt,
              program_key,
              variant_id,
            })
          } else {
            // console.log(
            //   `✅ Skipping already generated cue: ${cue_id}, variant: ${variant_id}.`
            // )

            skippedCount++
          }
        }
      }
    }

    console.log(`Skipping ${skippedCount} fully generated cues`)
    console.log(`Queuing ${allRequests.length} new generation requests...`)

    if (allRequests.length === 0) {
      console.log('All transcript cues have already been processed!')
      return
    }

    // Add all requests to the queue
    const promises = allRequests.map((request) =>
      this.queue.add(() => this.generateImage(request))
    )

    try {
      await Promise.all(promises)
      console.log(
        `✓ All ${allRequests.length} transcript cues processed successfully`
      )
    } catch (error) {
      console.error('✗ Some requests failed:', error)
    }
  }

  async processImageGenerationCues(): Promise<void> {
    console.log('Processing image generation cues...')

    const imageGenerationCues = cues.filter((cue) => cue.action === 'prompt')

    console.log(`Found ${imageGenerationCues.length} image generation cues`)

    if (imageGenerationCues.length === 0) {
      console.log('No image generation cues to process')
      return
    }

    const requests: GenerationRequest[] = []

    for (const cue of imageGenerationCues) {
      if (cue.action === 'prompt' && cue.prompt) {
        const prompt = cue.prompt
        const cueIndex = cues.indexOf(cue)
        const cue_id = `prompt_${cueIndex}_${cue.time.replace(/[:.]/g, '_')}`
        const program_key = cue.program || 'P0'

        requests.push({
          cue_id,
          prompt,
          program_key,
        })
      }
    }

    console.log(`Queuing ${requests.length} image generation requests...`)

    const promises = requests.map((request) =>
      this.queue.add(() => this.generateImage(request))
    )

    try {
      await Promise.all(promises)
      console.log('All image generation cues processed successfully')
    } catch (error) {
      console.error('Some requests failed:', error)
    }
  }

  async run(): Promise<void> {
    await this.init()

    // Check current state for resumption status
    const processedCues = await this.getProcessedCues()
    const transcriptCuesToGenerate = cues.filter(
      (cue) => cue.action === 'transcript' && cue.generate
    )

    const totalTranscriptCues = transcriptCuesToGenerate.length
    const alreadyProcessed = transcriptCuesToGenerate.filter((cue) => {
      const cueIndex = cues.indexOf(cue)
      const cue_id = `transcript_${cueIndex}_${cue.time.replace(/[:.]/g, '_')}`
      return processedCues.has(cue_id)
    }).length

    const remaining = totalTranscriptCues - alreadyProcessed

    console.log('=== Generation Status ===')
    console.log(`Total transcript cues: ${totalTranscriptCues}`)
    console.log(`Already processed: ${alreadyProcessed}`)
    console.log(`Remaining to process: ${remaining}`)

    if (alreadyProcessed > 0) {
      console.log('🔄 RESUMING previous session')
    } else {
      console.log('🆕 FRESH START - no previous progress found')
    }
    console.log('========================')

    // Process transcript cues first (as requested in README)
    await this.processTranscriptCues()

    // Optionally process image generation cues too
    // await this.processImageGenerationCues()

    console.log('✅ Generation requester finished')
  }
}

// Run the script
const requester = new GenerationRequester()
await requester.run()
