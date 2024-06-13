import {Outlet, createRootRoute} from '@tanstack/react-router'

import {HeadlessController} from '../components/HeadlessController'
import {StatusIndicator} from '../dictation'

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <HeadlessController />

      <div className="fixed right-3 bottom-3 z-10">
        <StatusIndicator />
      </div>
    </>
  ),
})
