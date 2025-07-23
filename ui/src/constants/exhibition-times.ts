// The video is 74 minutes, which is 74 * 60 seconds.
export const SCREENING_DURATION = 74 * 60 * 1000

/**
 * The exhibition runs from 9am to 9pm.
 * The video restarts every 75 minutes.
 * The video itself is 74 minutes long, followed by a 1-minute countdown.
 *
 * This means the video will restart at 9:00 (opening time), 10:15, 11:30, 12:45, 14:00,
 * 15:15, 16:30, 17:45, 19:00, and 20:15.
 * The last screening starts at 20:15, and the exhibition closes at 21:00.
 */
export function getExhibitionTimes() {
  const EXHIBITION_TIMES: string[] = [
    '09:00',
    '10:15',
    '11:30',
    '12:45',
    '14:00',
    '15:15',
    '16:30',
    '17:45',
    '19:00',
    '20:15',
  ]

  return EXHIBITION_TIMES
}
