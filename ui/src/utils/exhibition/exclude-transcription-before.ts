import {secOf} from './timecode'

import {AutomationCue} from '../../constants/exhibition-cues'

export const transcriptWithinTimeRange =
  (before: string, after: string) =>
  (cue: AutomationCue): boolean =>
    secOf(cue.time) >= secOf(before) && secOf(cue.time) <= secOf(after)
