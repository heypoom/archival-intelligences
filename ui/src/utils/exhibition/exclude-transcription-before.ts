import {secOf} from './timecode'

import {AutomationCue} from '../../constants/exhibition-cues'

export const excludeTranscriptionBefore =
  (before: string) =>
  (cue: AutomationCue): boolean =>
    secOf(cue.time) >= secOf(before)
