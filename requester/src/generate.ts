import {RedisClient} from 'bun'
import PQueue from 'p-queue'
import _cues from '../data/cues.json'
import type {AutomationCue} from './types'
import {
  MAX_VARIANT_COUNT,
  PREGEN_VERSION_ID,
  VALKEY_URL,
  PREGEN_UPLOAD_STATUS_KEY,
} from './constants'

const cues = _cues as AutomationCue[]

const MODAL_ENDPOINT =
  'https://heypoom--exhibition-pregen-text-to-image-endpoint.modal.run/generate'

const CONCURRENT_REQUESTS = 3

const REQUESTER_CUES_KEY = `requester/${PREGEN_VERSION_ID}/cues`
const REQUESTER_PROMPTS_KEY = `requester/${PREGEN_VERSION_ID}/prompts`
const REQUESTER_DURATIONS_KEY = `requester/${PREGEN_VERSION_ID}/durations`

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
      await this.vk.hmset(REQUESTER_CUES_KEY, [request.cue_id, '1'])

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
        const prompt = cue.transcript

        const cueIndex = cues.indexOf(cue)
        const cue_id = `transcript_${cueIndex}_${cue.time.replace(
          /[:.]/g,
          '_'
        )}`

        // For transcript cues, we'll use P0 as default program
        const program_key = 'P0'

        for (
          let variant_id = 1;
          variant_id <= MAX_VARIANT_COUNT;
          variant_id++
        ) {
          const [status] = await this.vk.hmget(PREGEN_UPLOAD_STATUS_KEY, [
            `${cue_id}_${variant_id}`,
          ])

          if (!status || status === '0') {
            console.log(
              `📚 Queuing an image: cue=${cue_id}, var=${variant_id}, prom=${prompt}, stat=${status}`
            )

            allRequests.push({
              cue_id,
              prompt,
              program_key,
              variant_id,
            })
          } else {
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

  async run(): Promise<void> {
    await this.init()

    const transcriptCuesToGenerate = cues.filter(
      (cue) => cue.action === 'transcript' && cue.generate
    )

    const totalTranscriptCues = transcriptCuesToGenerate.length

    console.log('=== Generation Status ===')
    console.log(`Total transcript cues: ${totalTranscriptCues}`)

    console.log('========================')

    await this.processTranscriptCues()

    console.log('✅ Generation requester finished')
  }
}

// Run the script
const requester = new GenerationRequester()
await requester.run()
