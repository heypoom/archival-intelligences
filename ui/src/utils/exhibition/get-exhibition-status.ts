import {hhmmOf} from './timecode'

import {
  EXHIBITION_DURATION,
  EXHIBITION_TIMES,
} from '../../constants/exhibition-times'

import {ExhibitionStatus} from '../../types/exhibition-status'

export function getExhibitionStatus(now: Date = new Date()): ExhibitionStatus {
  const times = EXHIBITION_TIMES.map((timecode) => hhmmOf(timecode))

  for (let i = 0; i < times.length; i++) {
    const time = times[i]
    const exhibitionTime = EXHIBITION_TIMES[i]
    const endTime = new Date(time.getTime() + EXHIBITION_DURATION)

    if (now < time) {
      return {type: 'wait', next: exhibitionTime}
    }

    if (now >= time && now < endTime) {
      return {type: 'active', start: exhibitionTime}
    }
  }

  return {type: 'closed'}
}
