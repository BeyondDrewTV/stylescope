import React from 'react'
import ReactDOM from 'react-dom/client'
import { GameProvider } from './context/GameContext'
import { BiomeShell } from './components/BiomeShell'
import { GameToasts } from './components/GameToasts'
import App from './stylescope-v8.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GameProvider>
      <BiomeShell>
        <App />
        <GameToasts />
      </BiomeShell>
    </GameProvider>
  </React.StrictMode>,
)
