import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'
import './theme/fonts.css'
import './theme/tokens.css'
import './theme/base.css'
import './theme/shell.css'
import './theme/components.css'
import './theme/fair.css'
import './theme/swipe.css'
import './theme/lists.css'
import './theme/interaction.css'
import './theme/share.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
