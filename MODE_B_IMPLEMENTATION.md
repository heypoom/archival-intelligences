# Mode B Implementation Plan: Pre-randomized Image Generation

## Overview

Mode B is the critical missing piece for reliable exhibition deployment. It pre-generates multiple randomized sets of images for each automation cue, eliminating live inference dependencies while maintaining the illusion of real-time AI generation.

## Current Status

### ✅ What's Working
- **Cue System**: Complete automation cue system combining transcript + manual cues
- **Modal Scripts**: Functional text-to-image and image-to-image generation endpoints
- **Preprocessor**: Basic cue filtering and analysis

### ❌ What's Missing
- **Batch Generation System**: No pre-generation of image sets
- **Object Storage Integration**: No R2 storage implementation
- **Metadata Management**: No timing/duration JSON generation
- **Static File Serving**: No serving of pre-generated content
- **Mode Switching**: No way to switch between live (Mode C) and static (Mode B)

## Architecture Design

### Directory Structure
```
r2://archival-intelligences/
├── actions/
│   ├── transcript_001/          # Transcript cue ID
│   │   ├── sets/
│   │   │   ├── 0/               # Random set 0
│   │   │   │   ├── 1.jpg        # Step 1 preview
│   │   │   │   ├── 2.jpg        # Step 2 preview
│   │   │   │   ├── ...
│   │   │   │   ├── 20.jpg       # Final step
│   │   │   │   └── meta.json    # Timing metadata
│   │   │   ├── 1/               # Random set 1
│   │   │   └── ...
│   │   └── config.json          # Generation parameters
│   ├── prompt_002/              # Manual prompt cue ID
│   │   ├── sets/
│   │   └── config.json
│   └── ...
└── manifest.json               # Master manifest
```

### Metadata Format
```json
// actions/{cue_id}/sets/{set_id}/meta.json
{
  "cue_id": "transcript_001",
  "set_id": 0,
  "total_steps": 20,
  "durations": {
    "1": 0.8,    // Time to generate step 1
    "2": 0.6,    // Time to generate step 2
    "...": "...",
    "20": 0.9,   // Time to generate final step
    "final": 0.4 // Time between last step and completion
  },
  "total_duration": 18.5,
  "generated_at": "2025-01-15T10:30:00Z",
  "model_config": {
    "program": "P0",
    "prompt": "machine learning summit in paris",
    "num_inference_steps": 20,
    "guidance_scale": 7.5
  }
}
```

### Master Manifest
```json
// manifest.json
{
  "version": "1.0.0",
  "generated_at": "2025-01-15T10:30:00Z",
  "total_actions": 45,
  "sets_per_action": 5,
  "actions": {
    "transcript_001": {
      "type": "transcript",
      "program": "P0",
      "prompt": "machine learning summit in paris",
      "sets": 5,
      "steps": 20
    },
    "prompt_002": {
      "type": "prompt", 
      "program": "P2",
      "prompt": "painting like epic poem of malaya",
      "sets": 5,
      "steps": 15
    }
  }
}
```

## Implementation Phases

### Phase 1: Batch Generation System

#### 1.1 Enhanced Preprocessor
**File**: `/preprocessor/batch-generator.ts`

```typescript
interface GenerationTask {
  actionId: string
  cueType: 'transcript' | 'prompt'
  program: ProgramId
  prompt: string
  overridePrompt?: string
  guidanceScale?: number
  numInferenceSteps: number
  setsToGenerate: number
}

class BatchGenerator {
  async generateAllSets(): Promise<void>
  async generateActionSets(task: GenerationTask): Promise<void>
  async uploadToR2(actionId: string, setId: number, files: ImageSet): Promise<void>
}
```

**Key Features**:
- Parse cues.json into generation tasks
- Generate S sets for each image generation cue
- Parallel processing with p-queue for rate limiting
- Progress tracking and resumable generation
- Error handling and retry logic

#### 1.2 Modal Batch Endpoints
**File**: `/exhibition_batch_generator.py`

```python
@stub.function(
    image=base_image,
    gpu="H100",
    timeout=600,
    container_idle_timeout=120,
)
@web_endpoint(method="POST")
def generate_action_set(request_data: dict):
    """Generate complete image set for one action/set combination."""
    # Generate all steps (1 to num_inference_steps)
    # Return all images + timing metadata
    # Upload directly to R2 from Modal
    pass

@stub.function()
def batch_generate_all():
    """Orchestrate generation of all action sets."""
    # Read manifest of required generations
    # Spawn parallel generate_action_set calls
    # Update master manifest
    pass
```

### Phase 2: Object Storage Integration

#### 2.1 R2 Storage Client
**File**: `/utils/r2-client.ts`

```typescript
class R2Client {
  async upload(key: string, data: Buffer | Uint8Array): Promise<void>
  async download(key: string): Promise<Buffer>
  async list(prefix: string): Promise<string[]>
  async exists(key: string): Promise<boolean>
  async getMetadata(actionId: string, setId: number): Promise<Metadata>
}
```

#### 2.2 Storage Operations
- **Upload**: Modal functions upload generated images directly to R2
- **Download**: Frontend downloads images during exhibition playback
- **Caching**: Implement local cache for recently accessed images
- **Fallback**: Graceful degradation if R2 is unavailable

### Phase 3: Exhibition Playback System

#### 3.1 Static Image Serving
**File**: `/ui/src/utils/exhibition/static-image-provider.ts`

```typescript
class StaticImageProvider {
  async getRandomSet(actionId: string): Promise<ImageSet>
  async preloadNextImages(upcomingCues: AutomationCue[]): Promise<void>
  async simulateGenerationDelay(metadata: Metadata): Promise<void>
}
```

#### 3.2 Mode Switching
**File**: `/ui/src/utils/exhibition/mode-manager.ts`

```typescript
type ExhibitionMode = 'live' | 'static' | 'hybrid'

class ModeManager {
  currentMode: ExhibitionMode
  
  async switchMode(mode: ExhibitionMode): Promise<void>
  async checkStaticAvailability(cues: AutomationCue[]): Promise<boolean>
  getImageProvider(): LiveImageProvider | StaticImageProvider
}
```

### Phase 4: Integration & Testing

#### 4.1 Exhibition Automator Updates
**File**: `/ui/src/utils/exhibition/exhibition-automator.ts`

```typescript
// Add mode detection and image provider selection
export class ExhibitionAutomator {
  imageProvider: LiveImageProvider | StaticImageProvider
  
  async initializeMode(): Promise<void> {
    const hasStaticImages = await this.checkStaticAvailability()
    this.imageProvider = hasStaticImages 
      ? new StaticImageProvider() 
      : new LiveImageProvider()
  }
}
```

#### 4.2 WebSocket Integration
- **Mode Detection**: Auto-detect which mode to use based on R2 availability
- **Fallback Logic**: Switch from static to live if images missing
- **Progress Simulation**: Use metadata timings to simulate live generation
- **Preview Steps**: Display intermediate generation steps using cached images

## Development Workflow

### Step 1: Generate Cues
```bash
# In UI, open browser console after cues load
copy(JSON.stringify(window.cues))

# In preprocessor
echo $CLIPBOARD > cues.json
```

### Step 2: Generate Images
```bash
cd preprocessor
npm run generate    # Batch generate all image sets
```

### Step 3: Deploy & Test
```bash
# Upload to R2, test static mode
npm run test-static

# Test fallback to live mode
npm run test-fallback
```

## Technical Requirements

### Environment Variables
```bash
# R2 Configuration
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=xxx

# Generation Configuration  
SETS_PER_ACTION=5
DEFAULT_INFERENCE_STEPS=20
PARALLEL_GENERATIONS=3

# Mode Configuration
EXHIBITION_MODE=static|live|auto
```

### Dependencies
```json
{
  "@aws-sdk/client-s3": "^3.x.x",
  "p-queue": "^6.x.x", 
  "sharp": "^0.32.x"
}
```

## Success Criteria

### ✅ Phase 1 Complete
- [ ] Batch generator processes all cues
- [ ] Modal functions generate complete image sets
- [ ] All images uploaded to R2 with correct structure
- [ ] Metadata JSONs generated with timing information

### ✅ Phase 2 Complete  
- [ ] R2 client handles all storage operations
- [ ] Images downloadable via HTTP/CDN
- [ ] Local caching reduces bandwidth usage
- [ ] Error handling for storage failures

### ✅ Phase 3 Complete
- [ ] Static image provider serves pre-generated images
- [ ] Generation timing simulation feels realistic
- [ ] Mode switching works seamlessly
- [ ] Preview steps display correctly

### ✅ Phase 4 Complete
- [ ] Exhibition runs entirely from static images
- [ ] Performance matches live generation experience
- [ ] Fallback to live mode works when needed
- [ ] Zero downtime during exhibitions

## Risk Mitigation

### Storage Costs
- **Solution**: Use Cloudflare R2 (cheap egress, ~$0.015/GB storage)
- **Estimate**: 5 sets × 45 actions × 20 steps × 2MB = ~9GB total

### Generation Time
- **Solution**: Parallel processing with Modal autoscaling
- **Estimate**: 45 actions × 5 sets × 30s = ~3.75 hours total

### Bandwidth Usage
- **Solution**: Pre-loading + local caching during exhibitions
- **Estimate**: ~500MB per exhibition run

### Reliability
- **Solution**: Multiple fallback layers (static → live → error screen)
- **Testing**: Simulate all failure modes before deployment

## Timeline Estimate

- **Phase 1**: 2-3 days (batch generation system)
- **Phase 2**: 1-2 days (R2 integration)  
- **Phase 3**: 2-3 days (exhibition playback)
- **Phase 4**: 1-2 days (integration & testing)

**Total**: 6-10 days for complete Mode B implementation