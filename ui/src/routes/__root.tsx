import {Outlet, createRootRoute} from '@tanstack/react-router'

import {HeadlessController} from '../components/HeadlessController'

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <HeadlessController />
    </>
  ),
})
