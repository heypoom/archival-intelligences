import { createLazyFileRoute } from '@tanstack/react-router'

import {PromptManager} from "../components/PromptManager";

export const Route = createLazyFileRoute('/two')({
  component: Index,
})

function Index() {
  return <PromptManager keyword='malaya' />
}
