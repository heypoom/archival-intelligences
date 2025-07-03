import _cues from './cues.json'
import type {AutomationCue} from './types'
import PQueue from 'p-queue'

type ProgramId = 'P0' | 'P2' | 'P2B' | 'P3' | 'P3B' | 'P4'

interface GenerationTask {
  actionId: string
  cueIndex: number
  cueType: 'transcript' | 'prompt'
  program: ProgramId
  prompt: string
  overridePrompt?: string
  guidanceScale?: number
  numInferenceSteps: number
  setsToGenerate: number
  time: string
}

interface ImageSet {
  actionId: string
  setId: number
  steps: Map<number, Buffer> // step number -> image buffer
  metadata: GenerationMetadata
}

interface GenerationMetadata {
  cue_id: string
  set_id: number
  total_steps: number
  durations: Record<string, number>
  total_duration: number
  generated_at: string
  model_config: {
    program: ProgramId
    prompt: string
    override_prompt?: string
    num_inference_steps: number
    guidance_scale?: number
  }
}

interface ManifestEntry {
  type: 'transcript' | 'prompt'
  program: ProgramId
  prompt: string
  override_prompt?: string
  sets: number
  steps: number
  time: string
}

interface Manifest {
  version: string
  generated_at: string
  total_actions: number
  sets_per_action: number
  actions: Record<string, ManifestEntry>
}

const MODAL_ENDPOINT = process.env.MODAL_ENDPOINT || 'https://your-modal-app.modal.run'
const SETS_PER_ACTION = parseInt(process.env.SETS_PER_ACTION || '5')
const DEFAULT_INFERENCE_STEPS = parseInt(process.env.DEFAULT_INFERENCE_STEPS || '20')
const PARALLEL_GENERATIONS = parseInt(process.env.PARALLEL_GENERATIONS || '3')

export class BatchGenerator {
  private cues: AutomationCue[]
  private tasks: GenerationTask[]
  private queue: PQueue
  private manifest: Manifest

  constructor() {
    this.cues = _cues as AutomationCue[]
    this.tasks = []
    this.queue = new PQueue({ concurrency: PARALLEL_GENERATIONS })
    this.manifest = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      total_actions: 0,
      sets_per_action: SETS_PER_ACTION,
      actions: {}
    }
  }

  async initialize(): Promise<void> {
    console.log('🔄 Analyzing cues and creating generation tasks...')
    this.createGenerationTasks()
    console.log(`✅ Created ${this.tasks.length} generation tasks`)
    console.log(`📊 Total images to generate: ${this.tasks.length * SETS_PER_ACTION * DEFAULT_INFERENCE_STEPS}`)
  }

  private createGenerationTasks(): void {
    // Filter cues that require image generation
    const transcriptCues = this.cues.filter(
      (cue, index) => cue.action === 'transcript' && cue.generate === true
    )
    
    const promptCues = this.cues.filter(
      (cue, index) => cue.action === 'prompt'
    )

    console.log(`Found ${transcriptCues.length} transcript cues and ${promptCues.length} prompt cues`)

    // Create tasks for transcript cues (Program 0)
    transcriptCues.forEach((cue, index) => {
      if (cue.action === 'transcript') {
        const actionId = `transcript_${String(index).padStart(3, '0')}`
        const task: GenerationTask = {
          actionId,
          cueIndex: this.cues.findIndex(c => c === cue),
          cueType: 'transcript',
          program: 'P0',
          prompt: cue.transcript,
          numInferenceSteps: DEFAULT_INFERENCE_STEPS,
          setsToGenerate: SETS_PER_ACTION,
          time: cue.time
        }
        this.tasks.push(task)
        
        this.manifest.actions[actionId] = {
          type: 'transcript',
          program: 'P0',
          prompt: cue.transcript,
          sets: SETS_PER_ACTION,
          steps: DEFAULT_INFERENCE_STEPS,
          time: cue.time
        }
      }
    })

    // Create tasks for manual prompt cues
    promptCues.forEach((cue, index) => {
      if (cue.action === 'prompt') {
        const actionId = `prompt_${String(index).padStart(3, '0')}`
        const task: GenerationTask = {
          actionId,
          cueIndex: this.cues.findIndex(c => c === cue),
          cueType: 'prompt',
          program: cue.program,
          prompt: cue.prompt,
          overridePrompt: cue.override,
          guidanceScale: cue.guidance,
          numInferenceSteps: this.getInferenceSteps(cue.program),
          setsToGenerate: SETS_PER_ACTION,
          time: cue.time
        }
        this.tasks.push(task)

        this.manifest.actions[actionId] = {
          type: 'prompt',
          program: cue.program,
          prompt: cue.prompt,
          override_prompt: cue.override,
          sets: SETS_PER_ACTION,
          steps: this.getInferenceSteps(cue.program),
          time: cue.time
        }
      }
    })

    this.manifest.total_actions = this.tasks.length
  }

  private getInferenceSteps(program: ProgramId): number {
    // Different programs may use different inference steps
    switch (program) {
      case 'P0': return 20  // Text-to-image from transcript
      case 'P2': 
      case 'P2B': return 15 // Image-to-image (fewer steps)
      case 'P3':
      case 'P3B': return 20 // Text-to-image with LoRA
      case 'P4': return 20  // Text-to-image for people
      default: return DEFAULT_INFERENCE_STEPS
    }
  }

  async generateAllSets(): Promise<void> {
    console.log('🚀 Starting batch generation...')
    console.log(`⚡ Running ${PARALLEL_GENERATIONS} generations in parallel`)

    const startTime = Date.now()
    let completed = 0

    // Add all generation jobs to the queue
    const promises = this.tasks.flatMap(task => 
      Array.from({ length: task.setsToGenerate }, (_, setId) =>
        this.queue.add(async () => {
          try {
            await this.generateActionSet(task, setId)
            completed++
            const progress = (completed / (this.tasks.length * SETS_PER_ACTION) * 100).toFixed(1)
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
            console.log(`✅ ${progress}% complete (${completed}/${this.tasks.length * SETS_PER_ACTION}) - ${elapsed}s elapsed - ${task.actionId}/set_${setId}`)
          } catch (error) {
            console.error(`❌ Failed ${task.actionId}/set_${setId}:`, error)
            throw error
          }
        })
      )
    )

    await Promise.all(promises)

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(0)
    console.log(`🎉 Batch generation complete! Total time: ${totalTime}s`)

    // Save final manifest
    await this.saveManifest()
  }

  private async generateActionSet(task: GenerationTask, setId: number): Promise<void> {
    const startTime = Date.now()

    // Determine which Modal endpoint to use based on program
    const endpoint = this.getModalEndpoint(task.program)
    
    // Prepare request payload for shared pipeline API
    const payload = {
      action_id: task.actionId,
      set_id: setId,
      program: task.program,
      prompt: task.prompt,
      override_prompt: task.overridePrompt,
      guidance_scale: task.guidanceScale,
      num_inference_steps: task.numInferenceSteps,
      strength: task.program.startsWith('P2') ? 0.8 : undefined,
      upload_to_r2: true,
      upload_previews: true
    }

    try {
      const response = await fetch(`${MODAL_ENDPOINT}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Generation failed')
      }

      // Validate response has expected structure
      if (!result.success) {
        throw new Error(result.error || 'Generation failed')
      }

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
      const imageCount = result.preview_urls?.length || 0
      console.log(`🖼️  Generated ${task.actionId}/set_${setId} in ${totalTime}s (${imageCount} images)`)

    } catch (error) {
      console.error(`❌ Error generating ${task.actionId}/set_${setId}:`, error)
      throw error
    }
  }

  private getModalEndpoint(program: ProgramId): string {
    // All programs now use the unified single set endpoint
    return '/generate-single-set'
  }

  private async saveManifest(): Promise<void> {
    try {
      await Bun.write(
        'manifest.json',
        JSON.stringify(this.manifest, null, 2)
      )
      console.log('📄 Manifest saved to manifest.json')
    } catch (error) {
      console.error('❌ Failed to save manifest:', error)
      throw error
    }
  }

  async validateEnvironment(): Promise<boolean> {
    console.log('🔍 Validating environment...')

    // Check required environment variables
    const requiredEnvVars = [
      'MODAL_ENDPOINT',
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID', 
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME'
    ]

    const missing = requiredEnvVars.filter(envVar => !process.env[envVar])
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '))
      return false
    }

    // Test Modal endpoint connectivity
    try {
      const response = await fetch(`${MODAL_ENDPOINT}/health`, {
        method: 'GET',
        timeout: 5000
      })
      
      if (!response.ok) {
        console.error(`❌ Modal endpoint health check failed: ${response.status}`)
        return false
      }

      console.log('✅ Modal endpoint is healthy')
    } catch (error) {
      console.error('❌ Failed to connect to Modal endpoint:', error)
      return false
    }

    console.log('✅ Environment validation passed')
    return true
  }

  // Utility method to resume generation from a specific point
  async resumeGeneration(fromActionId?: string): Promise<void> {
    if (fromActionId) {
      const startIndex = this.tasks.findIndex(task => task.actionId === fromActionId)
      if (startIndex !== -1) {
        this.tasks = this.tasks.slice(startIndex)
        console.log(`🔄 Resuming from ${fromActionId} (${this.tasks.length} tasks remaining)`)
      }
    }
    
    await this.generateAllSets()
  }

  // Get generation statistics
  getStats(): {
    totalTasks: number
    totalSets: number
    totalImages: number
    estimatedTime: string
    estimatedStorage: string
  } {
    const totalTasks = this.tasks.length
    const totalSets = totalTasks * SETS_PER_ACTION
    const totalImages = this.tasks.reduce((sum, task) => 
      sum + (task.numInferenceSteps * task.setsToGenerate), 0
    )
    
    // Rough estimates
    const avgGenerationTime = 30 // seconds per set
    const estimatedTimeSeconds = totalSets * avgGenerationTime
    const estimatedTime = `${Math.round(estimatedTimeSeconds / 3600)}h ${Math.round((estimatedTimeSeconds % 3600) / 60)}m`
    
    const avgImageSize = 2 // MB per image
    const estimatedStorageMB = totalImages * avgImageSize
    const estimatedStorage = estimatedStorageMB > 1000 
      ? `${(estimatedStorageMB / 1000).toFixed(1)}GB`
      : `${estimatedStorageMB}MB`

    return {
      totalTasks,
      totalSets,
      totalImages,
      estimatedTime,
      estimatedStorage
    }
  }
}