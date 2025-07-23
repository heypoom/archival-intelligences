export async function getServerTimeDrift() {
  const url = 'https://datenow.tuu.workers.dev/'
  const drifts = []

  for (let i = 0; i < 5; i++) {
    try {
      const startTime = Date.now()
      const response = await fetch(url)
      const endTime = Date.now()
      const data = await response.json()

      const serverTime = data.now
      const localTime = (startTime + endTime) / 2
      const drift = serverTime - localTime

      drifts.push(drift)
      console.log(`Request ${i + 1}: Time Drift = ${drift}ms`)

      // Add a small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 200))
    } catch (error) {}
  }

  // Sort the drifts to calculate median
  drifts.sort((a, b) => a - b)

  if (drifts.length === 0) {
    console.warn('No valid time drift data collected.')
    return 0
  }

  const median = drifts[Math.floor(drifts.length / 2)]

  console.log(`Median time drift: ${median}ms`)

  return median
}
