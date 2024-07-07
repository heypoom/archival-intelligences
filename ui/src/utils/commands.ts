import {$interacted} from '../store/exhibition'
import {$fadeStatus} from '../store/fader'

export const fullscreen = async () => {
  const isFullscreen = () =>
    document.fullscreenElement ||
    // @ts-expect-error - fff
    document.webkitFullscreenElement ||
    // @ts-expect-error - fff
    document.mozFullScreenElement

  try {
    if (!isFullscreen()) {
      await document.documentElement.requestFullscreen({navigationUI: 'hide'})
    }
  } catch (err) {
    console.log(
      `[failed to enter fullscreen]: ${err}, interacted=${$interacted.get()}`
    )
  }
}

export const black = () => $fadeStatus.set(!$fadeStatus.get())
