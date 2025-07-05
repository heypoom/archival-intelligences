# Debug Image Viewer for Image Generation Cues

Build a debug image viewer route into the frontend, where I can view the images and its metadata from the image generation cues. This React route is /image-viewer.

## Requirements

- Parse the transcript cues into transcript paths first.

  - Frontend already has the cues.json parsed.
  - See how the image paths can be derived in generate.ts.
  - Example of path format: `transcript_375_01_12_50/1/final.png`, where 375 is the cue number and 01:12:50 is the timecode. 1 is the variation id.
  - The images are stored on <https://images.poom.dev/foigoi/PATH> where path is described above.
  - Example: `https://images.poom.dev/foigoi/cues/transcript_375_01_12_50/1/final.png`

- Make an image viewer that lets you view these images quickly.

  - Left/Right arrow: move across transcript folder (~100ish).
  - Up/Down arrow: move across variations of the same cue (1 - 10).
  - Any images could be missing. You must show a "missing image" if any image failed to load. Do not crash the viewer.

- Show the timecode, program key (fow now all of them is P0 since we should load just the transcript cue first), text prompt and variation id (1 - 10) for each image on screen.

  - Show the keybinds guide too.

- Heads-up: The cue image viewer must support other 2 cue types in the next version, for the prompt and move_slider cue actions.
  - The other programs contains inference step preview images, where you may have `/foigoi/cues/prompt_400_01_12_50/1/3.png` which means the preview image is at the inference step 3, hence the "3.png".

## Implementation Plan

### Overview

Minimal debug image viewer implemented as a single React route at `/image-viewer` for viewing generated images from transcript cues with keyboard navigation.

### Implementation Details

#### 1. Route Structure

- **File**: `/ui/src/routes/image-viewer.lazy.tsx`
- **Route**: `/image-viewer` (accessible directly via URL)
- **Framework**: TanStack Router with lazy loading

#### 2. Core Functionality

- **Cue Parsing**: Filters `PROGRAM_CUES` for transcript cues with `generate: true`
- **Image Path Generation**: Uses same logic as `generate.ts`:

  ```typescript
  transcript_${allCueIndex}_${time.replace(/[:.]/g, '_')}/${variant}/final.png
  ```

- **Base URL**: `https://images.poom.dev/foigoi/cues/`

#### 3. Navigation System

- **Left/Right arrows**: Navigate between cues (~100 images) with wrap-around
- **Up/Down arrows**: Navigate between variants (1-10) of same cue with wrap-around
- **State Management**: Simple React useState for cueIndex and variantIndex

#### 4. UI Components

- **Image Display**: Center-positioned with max viewport sizing
- **Metadata Overlay**: Top-left corner showing:
  - Cue number (current/total)
  - Timecode
  - Variant number (1-10)
  - Program (P0 for transcript cues)
  - Text prompt (transcript content)
- **Keyboard Guide**: Top-right corner with navigation instructions
- **Status Bar**: Bottom center showing image load status

#### 5. Error Handling

- **Missing Images**: Shows placeholder with broken image icon and URL
- **No Cues**: Fallback message if no transcript cues found
- **Image Load Errors**: `onError` handler prevents crashes

#### 6. Styling

- **Theme**: Dark background (#424242) matching existing UI
- **Typography**: Monospace font for metadata consistency
- **Layout**: Full-screen with fixed overlays
- **No Animations**: Minimal and fast as requested

### Technical Specifications

#### State Management

```typescript
const [cueIndex, setCueIndex] = useState(0) // Current cue (0-based)
const [variantIndex, setVariantIndex] = useState(1) // Current variant (1-10)
const [imageError, setImageError] = useState(false) // Error state
```

#### Image Path Logic

```typescript
const versionId = 1 // static pregen version id
const allCueIndex = PROGRAM_CUES.indexOf(cue)
const cueId = `transcript_${allCueIndex}_${cue.time.replace(/[:.]/g, '_')}`
const imagePath = `https://images.poom.dev/foigoi/${versionId}/cues/${cueId}/${variant}/final.png`
```

#### Keyboard Event Handling

- **ArrowLeft/Right**: Navigate cues with bounds checking and wrap-around
- **ArrowUp/Down**: Navigate variants (1-10) with wrap-around
- **Automatic Error Reset**: Clears error state when navigating to new image

### Future Extensibility

The implementation is designed to easily support additional cue types:

- **Prompt Cues**: Can be filtered and displayed with program-specific paths
- **Move Slider Cues**: Can show inference step preview images (1.png, 2.png, etc.)
- **Path Generation**: Modular function can be extended for different cue types

### Completed Features

✅ Single-file React component with TanStack Router
✅ Cue parsing and filtering logic
✅ Image path generation matching backend logic
✅ Keyboard navigation (arrow keys)
✅ Metadata display (cue info, timecode, prompt, variant)
✅ Error handling for missing images
✅ Minimal dark theme styling
✅ No external dependencies or fancy transitions
