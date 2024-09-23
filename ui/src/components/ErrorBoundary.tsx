import {ErrorBoundary} from '@sentry/react'
import {useEffect} from 'react'

interface Props {
  children: React.ReactNode
}

const ErrorFallback = () => {
  useEffect(() => {
    // wait for Sentry to capture the error and reload the page.
    setTimeout(() => {
      // window.location.reload()
    }, 100)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center h-full font-mono min-h-screen bg-black text-white gap-y-8" />
  )
}

export function ProgramErrorBoundary(props: Props) {
  return (
    <ErrorBoundary fallback={ErrorFallback}>{props.children}</ErrorBoundary>
  )
}
