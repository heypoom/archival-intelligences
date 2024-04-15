import { createLazyFileRoute } from '@tanstack/react-router'

import { PromptManager } from '../components/PromptManager'

export const Route = createLazyFileRoute('/three')({
  component: Index,
})

function Index() {
  return <PromptManager keyword='mia tee painting' command='P3' />
}
