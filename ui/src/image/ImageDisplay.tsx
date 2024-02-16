import {useStore} from '@nanostores/react'
import {$imageUrls} from '../store/images'

export const ImageDisplay = () => {
  const urls = useStore($imageUrls)
  const first = urls[0]?.url

  return (
    <div className="min-h-screen w-full bg-[#111]">
      {first && (
        <img
          src={first}
          alt="generated"
          className="w-full object-fit object-center"
        />
      )}
    </div>
  )
}
