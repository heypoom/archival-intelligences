import {useMatchRoute} from '@tanstack/react-router'
import {$videoMode} from '../store/exhibition'

export function useIsVideo(): boolean {
  const mr = useMatchRoute()

  return !!mr({to: '/video'}) || $videoMode.get()
}
