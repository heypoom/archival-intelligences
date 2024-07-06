import {useEffect, useState} from 'react'
import {usePreviousDistinct} from 'react-use'

const CROSSFADE_TIME = 3000

export function useCrossFade(
  url: string,
  strict = true,
  delay = CROSSFADE_TIME
) {
  const [crossfading, setCrossfading] = useState(false)

  const prevUrl = usePreviousDistinct(url)

  useEffect(() => {
    const shouldFade = prevUrl !== url && (strict ? url && prevUrl : true)

    if (shouldFade) {
      setCrossfading(true)

      setTimeout(() => {
        setCrossfading(false)
      }, delay)
    }
  }, [url, prevUrl, delay, strict])

  return {crossfading, prevUrl}
}
