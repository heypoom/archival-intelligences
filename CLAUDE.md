# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Grounds of Intelligences" - an interactive AI-powered exhibition system for Ho Rui An's performance lecture. The system combines real-time speech recognition, AI image generation, and automated program sequencing for live performances and exhibitions.

## Repository Structure

- `ui/` - React TypeScript frontend (main application)
- `legacy-api/` - Python FastAPI backend with WebSocket support (legacy)
- `preprocessor/` - TypeScript tool for batch generating randomized image sets from exhibition cues
- `serverless/` - Modal.com serverless functions for AI generation (new backend)

## Development Commands

### Frontend (ui/)

```bash
cd ui
pnpm install          # Install dependencies
pnpm dev              # Development server
pnpm build            # Production build
pnpm lint             # ESLint
pnpm test             # Vitest
```

### Backend (legacy-api/)

```bash
cd legacy-api
poetry install        # Install dependencies
make server           # Start FastAPI server (uses CUDA)
```

### Preprocessor (preprocessor/)

```bash
cd preprocessor
bun install           # Install dependencies
bun run cue-check     # Debug command to get number of cues
```

## Architecture Overview

### Exhibition System

- **Time-based Automation**: Precise cue system drives all program transitions
- **Multi-window Coordination**: BroadcastChannel IPC synchronizes video/program displays
- **Exhibition Modes**: Live lecture, pre-randomized generation, live generation from transcript

### Frontend Architecture

- **React + TanStack Router**: Route-based programs (`/zero`, `/one-four`, `/video`)
- **Nanostores**: Reactive state management with persistent atoms
- **Key Stores**: `exhibition.ts`, `dictation.ts`, `images.ts`, `window-ipc.ts`
- **ExhibitionAutomator**: Central controller in `utils/exhibition/exhibition-automator.ts`

### Backend Communication

- **WebSocket Protocol**: Different endpoints per program (P0, P2, P3, P4)
- **Message Types**: Text commands, progress updates, binary image data
- **Connection Management**: Auto-reconnection and stuck generation detection

### AI Generation Pipeline

1. Speech captured via dictation → text prompts
2. WebSocket commands to program-specific endpoints
3. Real-time diffusion model processing with preview streams
4. Generated images displayed in coordinated exhibition sequence

## Key Files

### Frontend Core

- `ui/src/main.tsx` - React entry point
- `ui/src/routes/__root.tsx` - Exhibition UI layout with overlays
- `ui/src/utils/exhibition/exhibition-automator.ts` - Main automation controller
- `ui/src/manager/socket.ts` - WebSocket communication manager

### Backend Core

- `legacy-api/server.py` - FastAPI server with WebSocket endpoints
- `legacy-api/utils/pipeline_manager.py` - AI model pipeline management
- `serverless/live/` - Modal.com serverless generation functions

### State Management

- Exhibition timing and status in `ui/src/store/exhibition.ts`
- Speech recognition in `ui/src/store/dictation.ts`
- Generated images in `ui/src/store/images.ts`
- Multi-window IPC in `ui/src/store/window-ipc.ts`

## Testing

Frontend uses Vitest. Run tests with:

```bash
cd ui && pnpm test
```

## Development Notes

- **Timing Critical**: Exhibition cues are precisely timed - test timing changes carefully
- **Multi-display Setup**: System designed for separate video and program windows
- **WebSocket Dependencies**: Backend must be running for full frontend functionality
- **AI Model Updates**: LoRA and image-to-image pipelines may need rebuilding when models update
- **Biome Formatting**: Frontend uses Biome with 2-space indentation and specific JS formatting rules

## Cue System

Cues are stored in `ui/src/constants/exhibition-cues.ts` and drive automated actions:

- Navigation between programs
- Image generation triggers
- Fade in/out effects
- Transcription control

To update cues from transcript, follow process in README.md section "How to get the latest cue for the preprocessor".

## Offline Mode System

### Automation Replay Mode

- **Implementation**: `ui/src/utils/exhibition/offline-automation-replay.ts`
- **Purpose**: Runs exhibition timeline using pre-generated images instead of live AI generation
- **Features**: Debug time slider, step-by-step inference simulation, fade status management
- **Image Paths**: `https://images.poom.dev/foigoi/{version}/cues/{cueId}/{variant}/{fileName}`

### Continuous Regeneration (Program B)

- **Target Programs**: P2B, P3B, P4B with `enter: {regen: true}` property
- **Behavior**: Continuous image regeneration until next cue (mimics live system)
- **Implementation**: Functions in `ui/src/utils/exhibition/offline-automation-replay.ts`
- **State Management**: Reuses existing `$regenCount`, `$regenActive`, `$regenEnabled` atoms
- **Delay Logic**: 30s base + (count-6)\*30s incremental after 6th generation

### Key Files for Offline Mode

- `ui/src/utils/exhibition/offline-automation-replay.ts` - Core offline replay system with regeneration
- `ui/src/utils/exhibition/run-offline-automation-action.ts` - Offline action handlers
- `ui/src/utils/exhibition/route-from-cue.ts` - Route restoration from timeline position
- `ui/src/components/DebugTimeSlider.tsx` - Debug time seeking controls

## Planning Process

- **Plan Files**: Create planning documents in `docs/plans/` directory before starting implementation
- **Purpose**: Allows for easy editing and review of implementation plans
- **Format**: Markdown files with clear goals, tasks, and design specifications
- **Workflow**: Always update plan files first when changes are needed, then proceed with implementation
