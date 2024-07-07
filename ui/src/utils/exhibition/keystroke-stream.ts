function getCommonPrefixLength(str1: string, str2: string) {
  let length = 0
  const minLength = Math.min(str1.length, str2.length)

  while (length < minLength && str1[length] === str2[length]) {
    length++
  }

  return length
}

export function* keystrokeStream(from: string, to: string) {
  const commonPrefixLength = getCommonPrefixLength(from, to)

  // Erase remaining characters from `from`
  for (let i = from.length; i > commonPrefixLength; i--) {
    yield from.slice(0, i - 1)
  }

  // Type new characters from `to`
  for (let i = commonPrefixLength; i <= to.length; i++) {
    yield to.slice(0, i)
  }
}

export const getRandomDelay = (base: number, variance: number) =>
  base + (Math.random() * variance - variance / 2)
