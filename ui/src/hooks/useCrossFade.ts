import {useEffect, useState} from 'react'
import {usePreviousDistinct} from 'react-use'

const CROSSFADE_TIME = 3000

export function useCrossFade(
  url: string,
  options: {strict?: boolean; delay?: number; skipFade?: boolean} = {}
) {
  const {
    strict = true,
    delay = CROSSFADE_TIME,
    skipFade = false,
  } = options ?? {}

  const [crossfading, setCrossfading] = useState(false)

  const prevUrl = usePreviousDistinct(url)

  useEffect(() => {
    const shouldFade =
      !skipFade && prevUrl !== url && (strict ? url && prevUrl : true)

    if (shouldFade) {
      setCrossfading(true)

      setTimeout(() => {
        setCrossfading(false)
      }, delay)
    }
  }, [url, prevUrl, delay, strict, skipFade])

  return {crossfading, prevUrl}
}
