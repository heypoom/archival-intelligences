import {Outlet, createRootRoute} from '@tanstack/react-router'

import {HeadlessController} from '../components/HeadlessController'
import {StatusIndicator} from '../dictation'
import {CurrentProgramBadge} from '../components/CurrentProgramBadge'
import FadeToBlack from '../components/FadeToBlack'
import {ProgressBadge} from '../components/ProgressBadge'
import {AnimatedNoise} from '../components/AnimatedNoise'
import {RegenCountBadge} from '../components/RegenCountBadge'
import {ExhibitionFallbackVideo} from '../components/ExhibitionFallbackVideo'
import {SettingsButton} from '../components/SettingsButton'

export const Route = createRootRoute({
  component: () => (
    <div className="cursor-none">
      <ExhibitionFallbackVideo />
      <Outlet />
      <HeadlessController />

      <div className="fixed flex left-3 bottom-3 z-[10001] gap-x-1 cursor-pointer">
        <SettingsButton />
        <CurrentProgramBadge />
        <RegenCountBadge />
        <ProgressBadge />
      </div>

      <div className="fixed right-3 bottom-3 z-10">
        <StatusIndicator />
      </div>

      <FadeToBlack />
      <AnimatedNoise />
    </div>
  ),
})
