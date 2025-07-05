import {RedisClient} from 'bun'
import PQueue from 'p-queue'
import _cues from '../data/cues.json'
import type {AutomationCue} from './types'

const cues = _cues as AutomationCue[]

const MODAL_ENDPOINT =
  'https://heypoom--exhibition-pregen-text-to-image-endpoint.modal.run/generate'
const VALKEY_URL = 'redis://raya.poom.dev:6379'
const CONCURRENT_REQUESTS = 3

interface GenerationRequest {
  cue_id: string
  prompt: string
  program_key: string
}

class GenerationRequester {
  private queue: PQueue
  private valkey: RedisClient

  constructor() {
    this.queue = new PQueue({concurrency: CONCURRENT_REQUESTS})
    this.valkey = new RedisClient(VALKEY_URL)
  }

  async init() {
    console.log('Initializing Generation Requester...')
    console.log(`Using Modal endpoint: ${MODAL_ENDPOINT}`)
    console.log(`Using Valkey at: ${VALKEY_URL}`)
    console.log(`Concurrent requests: ${CONCURRENT_REQUESTS}`)
  }

  async getProcessedCues(): Promise<Set<string>> {
    try {
      const processedCues = await this.valkey.hgetall('requests/cues')
      const cueIds = new Set(processedCues ? Object.keys(processedCues) : [])
      console.log(`Found ${cueIds.size} already processed cues in Valkey`)
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

      const response = await fetch(MODAL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          program_key: request.program_key,
          cue_id: request.cue_id,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      await response.json()
      console.log(`✓ Generated image for cue ${request.cue_id}`)

      // Mark as processed in Valkey
      await this.valkey.hincrby('requests/cues', request.cue_id, 1)

      await this.valkey.hmset('requests/cue/prompts', [
        request.cue_id,
        request.prompt,
      ])
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

    // Get already processed cues first
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

        // Check if this cue has already been processed
        if (processedCues.has(cue_id)) {
          skippedCount++
          continue
        }

        // For transcript cues, we'll use P0 as default program
        // You might want to adjust this based on your specific requirements
        const program_key = 'P0'

        allRequests.push({
          cue_id,
          prompt,
          program_key,
        })
      }
    }

    console.log(`Skipping ${skippedCount} already processed cues`)
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
      console.log(`✓ All ${allRequests.length} transcript cues processed successfully`)
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
    const alreadyProcessed = transcriptCuesToGenerate.filter(cue => {
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
