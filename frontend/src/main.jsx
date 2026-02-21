import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './stylescope-v8.jsx'

// Gamification (GameProvider, BiomeShell, GameToasts) disabled for v1.
// Re-enable here when Pepper's Universe is added back.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
