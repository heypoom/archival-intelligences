import {useMatchRoute, useNavigate} from '@tanstack/react-router'
import {Icon} from '@iconify/react'

export const SettingsButton = () => {
  const navigate = useNavigate()
  const mr = useMatchRoute()

  if (mr({to: '/'})) return null

  return (
    <button
      onClick={() => navigate({to: '/'})}
      className="bg-[#2d2d30] text-white leading-3 p-[3px] w-5 h-5 rounded-full text-xs flex items-center justify-center z-100000 focus:outline-none focus:ring focus:ring-violet-300 focus:bg-violet-500 hover:bg-violet-500 cursor-pointer"
    >
      <Icon icon="lucide:settings" fontSize={18} />
    </button>
  )
}
