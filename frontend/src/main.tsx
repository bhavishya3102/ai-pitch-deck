import { ClerkProvider } from '@clerk/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthBridge } from './components/AuthBridge.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { SetupNotice } from './components/SetupNotice.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const root = createRoot(document.getElementById('root')!)

// Without a usable key ClerkProvider throws and the page goes blank — explain instead
if (!publishableKey?.startsWith('pk_')) {
  root.render(
    <StrictMode>
      <SetupNotice reason={publishableKey ? 'invalid' : 'missing'} />
    </StrictMode>,
  )
} else {
  root.render(
    <StrictMode>
      {/* A key Clerk rejects at runtime lands here instead of a blank screen */}
      <ErrorBoundary fallback={<SetupNotice reason="invalid" />}>
        <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
          <QueryClientProvider client={queryClient}>
            <AuthBridge />
            <App />
          </QueryClientProvider>
        </ClerkProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}
