import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './theme/fonts.css'

function App() {
  return <h1>Board-a-licious</h1>
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>)
