export function isGoogleChrome(): boolean {
  // @ts-expect-error - please
  const isChromium = window.chrome
  const winNav = window.navigator
  const vendorName = winNav.vendor

  // @ts-expect-error - please
  const isOpera = typeof window.opr !== 'undefined'
  const isIEedge = winNav.userAgent.indexOf('Edg') > -1
  const isIOSChrome = winNav.userAgent.match('CriOS')

  const isGoogleChrome =
    // @ts-expect-error - please
    winNav.userAgentData.brands[0].brand === 'Google Chrome'

  if (isIOSChrome) {
    return false
  }

  if (
    isChromium !== null &&
    typeof isChromium !== 'undefined' &&
    vendorName === 'Google Inc.' &&
    isOpera === false &&
    isIEedge === false &&
    isGoogleChrome
  ) {
    return true
  }

  return false
}
