import {useStore} from '@nanostores/react'

import {$fadeStatus} from '../store/fader'

export const FadeToBlack = () => {
  const visible = useStore($fadeStatus)

  return (
    <div
      className={`fixed z-[100] inset-0 bg-black transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{pointerEvents: visible ? 'auto' : 'none'}}
    />
  )
}

export default FadeToBlack
