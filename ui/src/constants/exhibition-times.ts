import dayjs from 'dayjs'

import {SCREENING_END_TIME} from './exhibition-cues'

import {secOf} from '../utils/exhibition/timecode'

export const SCREENING_DURATION = secOf(SCREENING_END_TIME) * 1000

const isOpeningDay = (): boolean => dayjs().format('MM-DD') === '09-24'

/**
 * To better manage the viewing process, I'm thinking of having the video restart every 90 mins,
 * so we can indicate exact start times for the audience to anticipate.
 *
 * This means the video will restart at 11:00 (opening time), 12:30, 14:00, 15:30, 17:00,
 * 18:30 (exhibition closes at 19:00).
 *
 * This also means we need to add a 15-min countdown after the video ends,
 * which will run until the video restarts.
 *
 * It’ll be just 9:45 to 21:00 everyday.
 */
export function getExhibitionTimes() {
  const EXHIBITION_TIMES: string[] = [
    '09:45',
    '11:00',
    '12:15',
    '13:30',
    '14:45',
    '16:00',
    '17:15',
    '18:30',
    '19:45',
  ]

  if (isOpeningDay()) EXHIBITION_TIMES.push('21:00')

  return EXHIBITION_TIMES
}
