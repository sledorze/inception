import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

function App() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Hello</h1>
    </div>
  )
}

const root = document.querySelector<HTMLElement>('#root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
