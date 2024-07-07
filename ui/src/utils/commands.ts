import {$fadeStatus} from '../store/fader'

export const fullscreen = () => {
  const isFullscreen = () =>
    document.fullscreenElement ||
    // @ts-expect-error - fff
    document.webkitFullscreenElement ||
    // @ts-expect-error - fff
    document.mozFullScreenElement

  if (!isFullscreen()) {
    document.documentElement.requestFullscreen().then()
  }
}

export const black = () => $fadeStatus.set(!$fadeStatus.get())
