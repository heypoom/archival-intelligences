import {useStore} from '@nanostores/react'

import {$fadeStatus} from '../store/fader'
import {useMatchRoute} from '@tanstack/react-router'

export const FadeToBlack = () => {
  const visible = useStore($fadeStatus)

  const mr = useMatchRoute()
  const cannotFadeToBlack = mr({to: '/'})

  if (cannotFadeToBlack) return null

  return (
    <div
      className={`fixed z-[100000] w-full h-full top-0 left-0 inset-0 bg-black transition-opacity duration-[5s] ease-in-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{pointerEvents: visible ? 'auto' : 'none'}}
    />
  )
}

export default FadeToBlack
