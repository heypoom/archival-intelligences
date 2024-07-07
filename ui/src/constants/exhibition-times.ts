import dayjs from 'dayjs'

/** Each screening is about 90 minutes */
export const SCREENING_DURATION = 90 * 60 * 1000

export const EXHIBITION_TIMES: string[] = [
  '11:00',
  '12:30',
  '14:00',
  '15:30',
  '17:00',
  '18:30',
]

// Vernissage is July 12th
const isVernissage = (): boolean => dayjs().format('MM-DD') === '07-12'

// We show the exhibition at 20:00 on the vernissage
if (isVernissage()) EXHIBITION_TIMES.push('20:00')
