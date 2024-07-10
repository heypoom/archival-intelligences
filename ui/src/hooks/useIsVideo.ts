import {useMatchRoute} from '@tanstack/react-router'

export function useIsVideo() {
  const mr = useMatchRoute()

  return mr({to: '/video'})
}
