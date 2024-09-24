const videoSource = 'https://rui-an-fr-videos.poom.dev/rui-an-sep-24-fast.mp4'

export const EXHIBITION_VIDEO_SOURCES = {
  // Main lecture video shown to the audience
  lecture: videoSource,

  // Emergency fallback video shown when the GPU server crashes
  programFallback: videoSource,
} as const
