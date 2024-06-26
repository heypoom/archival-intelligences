import { createLazyFileRoute } from '@tanstack/react-router'

import { PromptManager } from '../components/PromptManager'

export const Route = createLazyFileRoute('/two')({
  component: Index,
})

function Index() {
  return <PromptManager keyword='epic poem of malaya' command='P2' />
}
