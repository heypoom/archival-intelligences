import {createLazyFileRoute} from '@tanstack/react-router'

import {PromptManager} from '../components/PromptManager'

export const Route = createLazyFileRoute('/two-b')({
  component: Index,
})

function Index() {
  return <PromptManager keyword="different composition" command="P2B" />
}
