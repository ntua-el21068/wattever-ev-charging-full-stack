// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HeroUIProvider } from '@heroui/react'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <HeroUIProvider>
        <main className="dark text-foreground bg-background min-h-screen">
          <App />
        </main>
      </HeroUIProvider>
    </BrowserRouter>
  </React.StrictMode>,
)