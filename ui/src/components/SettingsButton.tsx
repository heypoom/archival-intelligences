import {Link} from '@tanstack/react-router'

export const SettingsButton = () => {
  return (
    <Link to="/">
      <button className="bg-[#2d2d30] text-white leading-3 px-[5px] py-[4px] rounded-md text-xs flex z-100000">
        BACK
      </button>
    </Link>
  )
}
