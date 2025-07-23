import '@fontsource/inter'

import {
  RouterProvider,
  createHashHistory,
  createRouter,
} from '@tanstack/react-router'
import {StrictMode} from 'react'
import ReactDOM from 'react-dom/client'

import {routeTree} from './routeTree.gen'

import './utils/sentry'

import 'animate.css'

import './index.css'

const history = createHashHistory()
const router = createRouter({routeTree, history})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const container = document.getElementById('root')

if (container && !container.innerHTML) {
  const root = ReactDOM.createRoot(container)

  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
}
