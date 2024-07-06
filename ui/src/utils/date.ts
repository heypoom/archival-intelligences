import dayjs from 'dayjs'

export const hourOf = (hour: number, minute: number): Date =>
  dayjs().set('hour', hour).set('minute', minute).toDate()

export const parseTime = (input: string): Date => {
  const [hour, minute] = input.split(':').map(Number)

  return hourOf(hour, minute)
}
