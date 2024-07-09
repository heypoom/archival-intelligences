import {hhmmOf} from './timecode'

import {
  SCREENING_DURATION,
  getExhibitionTimes,
} from '../../constants/exhibition-times'

import {ExhibitionStatus} from '../../types/exhibition-status'

export function getExhibitionStatus(now: Date = new Date()): ExhibitionStatus {
  const EXHIBITION_TIMES = getExhibitionTimes()
  const timecodes = EXHIBITION_TIMES.map((timecode) => hhmmOf(timecode))

  for (let i = 0; i < timecodes.length; i++) {
    const time = timecodes[i]
    const exhibitionTime = EXHIBITION_TIMES[i]
    const endTime = new Date(time.getTime() + SCREENING_DURATION)

    if (now < time) {
      return {type: 'wait', next: exhibitionTime}
    }

    if (now >= time && now < endTime) {
      return {type: 'active', start: exhibitionTime}
    }
  }

  return {type: 'closed'}
}
