import {AutomationCue} from '../../constants/exhibition-cues'

/**
 * Determine the correct route based on the current cue index and cues list.
 * This function looks backwards through the cues to find the most recent navigation action.
 */
export function routeFromCue(
  currentCueIndex: number,
  cues: AutomationCue[]
): string | null {
  // Default to index page if no cue or invalid index
  if (currentCueIndex < 0 || !cues.length) {
    return '/'
  }

  // Look backwards from current cue to find the most recent navigation action
  for (let i = currentCueIndex; i >= 0; i--) {
    const cue = cues[i]

    if (cue.action === 'navigate') {
      return cue.route
    }
  }

  return null
}
