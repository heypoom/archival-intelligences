import {$fadeStatus} from '../store/fader'

export const fullscreen = () => document.documentElement.requestFullscreen()
export const black = () => $fadeStatus.set(!$fadeStatus.get())
