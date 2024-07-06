import dayjs from 'dayjs'

export const timeOf = (input: string): Date => {
  const [hour, minute] = input.split(':').map(Number)

  return dayjs().set('hour', hour).set('minute', minute).toDate()
}
