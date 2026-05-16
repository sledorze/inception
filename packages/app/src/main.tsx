import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'

const root = document.querySelector<HTMLElement>('#root')
if (root) {
  ReactDOM.createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
