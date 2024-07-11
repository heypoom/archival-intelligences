export function compareTimecode(a: string, b: string): number {
  // Split the timecode into hours, minutes, and seconds
  const [hoursA, minutesA, secondsA] = a.split(':').map(Number)
  const [hoursB, minutesB, secondsB] = b.split(':').map(Number)

  // Compare hours
  if (hoursA !== hoursB) {
    return hoursA - hoursB
  }

  // Compare minutes
  if (minutesA !== minutesB) {
    return minutesA - minutesB
  }

  // Compare seconds
  return secondsA - secondsB
}
