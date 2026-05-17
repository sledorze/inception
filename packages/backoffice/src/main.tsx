import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RegistryProvider } from '@effect/atom-react'
import './index.css'
import { App } from './App.tsx'

const root = document.querySelector<HTMLElement>('#root')
if (root) {
  ReactDOM.createRoot(root).render(
    <StrictMode>
      <RegistryProvider>
        <App />
      </RegistryProvider>
    </StrictMode>,
  )
}
