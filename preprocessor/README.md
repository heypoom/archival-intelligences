# Preprocessor - Mode B Batch Generator

This directory contains the batch generation system for Mode B (pre-randomized image generation) of the Archival Intelligences project.

## Overview

The preprocessor analyzes automation cues from the exhibition system and generates multiple randomized sets of images for each image generation action. This eliminates the need for live inference during exhibitions while maintaining the appearance of real-time AI generation.

## Files

- `process.ts` - Original cue analysis script
- `batch-generator.ts` - Main batch generation class
- `generate.ts` - CLI script for running batch generation
- `types.ts` - TypeScript type definitions
- `cues.json` - Automation cues exported from frontend
- `manifest.json` - Generated manifest of all image sets (created after generation)

## Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Modal and R2 credentials
   ```

3. **Export cues from frontend:**
   - Open the exhibition UI in browser
   - Wait for cues to load
   - Open browser console
   - Run: `copy(JSON.stringify(window.cues))`
   - Paste the result into `cues.json`

## Usage

### Analyze Cues
```bash
bun run analyze
```
Shows statistics about transcript and prompt cues that need image generation.

### Generate Image Sets
```bash
# Interactive mode (asks for confirmation)
bun run generate

# Force mode (no confirmation prompt)
bun run generate-force

# Resume from specific action
RESUME_FROM_ACTION=transcript_042 bun run generate
```

### Generation Statistics
The generator will show:
- Total tasks to process
- Total image sets to generate
- Total individual images
- Estimated generation time
- Estimated storage requirements

## Environment Variables

### Required
- `MODAL_ENDPOINT` - Your Modal app endpoint URL
- `R2_ACCOUNT_ID` - Cloudflare R2 account ID
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key
- `R2_BUCKET_NAME` - R2 bucket name

### Optional
- `SETS_PER_ACTION=5` - Number of randomized sets per action
- `DEFAULT_INFERENCE_STEPS=20` - Default inference steps
- `PARALLEL_GENERATIONS=3` - Concurrent generations
- `BATCH_GENERATE_CONFIRM=false` - Skip confirmation prompt if true
- `RESUME_FROM_ACTION` - Resume from specific action ID

## Output Structure

Images are uploaded to R2 with this structure:
```
r2://your-bucket/
├── actions/
│   ├── transcript_001/
│   │   ├── sets/
│   │   │   ├── 0/
│   │   │   │   ├── 1.jpg
│   │   │   │   ├── 2.jpg
│   │   │   │   ├── ...
│   │   │   │   ├── 20.jpg
│   │   │   │   └── meta.json
│   │   │   ├── 1/
│   │   │   └── ...
│   │   └── config.json
│   └── ...
└── manifest.json
```

## Generation Process

1. **Cue Analysis**: Filters automation cues for image generation actions
2. **Task Creation**: Creates generation tasks for each transcript/prompt cue
3. **Batch Processing**: Generates multiple sets in parallel using Modal
4. **Upload**: Images uploaded directly to R2 from Modal functions
5. **Metadata**: Timing information saved for realistic playback simulation

## Programs Supported

- **P0**: Text-to-image from transcript (20 steps)
- **P2/P2B**: Image-to-image with Malaya painting (15 steps) 
- **P3/P3B**: Text-to-image with Chua Mia Tee LoRA (20 steps)
- **P4**: Text-to-image for people generation (20 steps)

## Error Handling

- **Network failures**: Automatic retry with exponential backoff
- **Modal errors**: Detailed error logging and graceful failure
- **R2 upload issues**: Validation and retry logic
- **Resumable**: Can resume from any point using `RESUME_FROM_ACTION`

## Monitoring

During generation, the system shows:
- Real-time progress updates
- Completion percentage
- Time elapsed and remaining
- Success/failure status per set
- Final statistics and timing

## Next Steps

After batch generation completes:
1. Verify `manifest.json` contains all expected actions
2. Test R2 storage accessibility
3. Implement frontend static image provider
4. Configure exhibition system for Mode B playback
