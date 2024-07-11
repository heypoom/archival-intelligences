import {useStore} from '@nanostores/react'

import {$fadeStatus} from '../store/fader'

export const FadeToBlack = () => {
  const visible = useStore($fadeStatus)

  return (
    <div
      className={`fixed z-[1000000] w-full h-full top-0 left-0 inset-0 bg-black transition-opacity duration-[5s] ease-in-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{pointerEvents: visible ? 'auto' : 'none'}}
    />
  )
}

export default FadeToBlack
