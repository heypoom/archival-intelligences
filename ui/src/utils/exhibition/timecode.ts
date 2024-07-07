import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'

dayjs.extend(duration)

export const hhmmOf = (input: string): Date => {
  const [hour, minute] = input.split(':').map(Number)

  return dayjs()
    .set('hour', hour)
    .set('minute', minute)
    .set('second', 0)
    .toDate()
}

export const secOf = (timecode: string): number => {
  const [hours, minutes, seconds] = timecode.split(':').map(Number)

  return hours * 3600 + minutes * 60 + seconds
}

export const timecodeOf = (seconds: number): string => {
  const duration = dayjs.duration(seconds, 'seconds')

  const hours = Math.floor(duration.asHours()).toString().padStart(2, '0')
  const minutes = duration.minutes().toString().padStart(2, '0')
  const secs = duration.seconds().toString().padStart(2, '0')

  return `${hours}:${minutes}:${secs}`
}
