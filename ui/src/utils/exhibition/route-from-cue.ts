import {AutomationCue} from '../../constants/exhibition-cues'

export function routeFromCue(
  currentCue: number,
  cues: AutomationCue[]
): string {
  let route = '/zero'

  for (let cueId = 0; cueId <= currentCue; cueId++) {
    const cue = cues[cueId]

    if (cue.action === 'navigate') {
      route = cue.route
    } else if (cue.action === 'next') {
      route = '/one'
    }
  }

  console.log(`[route] ${route}`)

  return route
}
