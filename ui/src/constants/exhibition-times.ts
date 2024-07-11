import dayjs from 'dayjs'

/**
 * Each screening is 75 minutes.
 * Start countdown at 01:15:00.
 **/
export const SCREENING_DURATION = 75 * 60 * 1000

// Vernissage is July 12th
const isVernissage = (): boolean => dayjs().format('MM-DD') === '07-12'

/**
 * To better manage the viewing process, I'm thinking of having the video restart every 90 mins,
 * so we can indicate exact start times for the audience to anticipate.
 *
 * This means the video will restart at 11:00 (opening time), 12:30, 14:00, 15:30, 17:00,
 * 18:30 (exhibition closes at 19:00).
 *
 * This also means we need to add a 15-min countdown after the video ends,
 * which will run until the video restarts.
 */
export function getExhibitionTimes() {
  const EXHIBITION_TIMES: string[] = [
    '11:00',
    '12:30',
    '14:00',
    '15:30',
    '17:00',
    '18:30',
  ]

  // We show the exhibition at 20:00 on the vernissage
  // if (isVernissage()) EXHIBITION_TIMES.push('20:00')
  EXHIBITION_TIMES.push('20:00')

  return EXHIBITION_TIMES
}
