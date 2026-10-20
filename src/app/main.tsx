import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'
import { takeShare } from './share-target.ts'
import './theme/fonts.css'
import './theme/tokens.css'
import './theme/base.css'
import './theme/hexboard.css'
import './theme/shell.css'
import './theme/actionbar.css'
import './theme/viewer.css'
import './theme/showoff.css'
import './theme/ticker.css'
import './theme/components.css'
import './theme/fair.css'
import './theme/swipe.css'
import './theme/lists.css'
import './theme/interaction.css'
import './theme/share.css'
import './theme/share-sheet.css'
import './theme/intro.css'
import './theme/celebrate.css'

const root = document.getElementById('root')
if (root) {
  takeShare()

createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
