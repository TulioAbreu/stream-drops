import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import interFont from './assets/fonts/inter-var.woff2'
import balooFont from './assets/fonts/baloo2-var.woff2'
import monoFont from './assets/fonts/jetbrains-mono-var.woff2'

function preloadFont(href: string) {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'font'
  link.type = 'font/woff2'
  link.crossOrigin = 'anonymous'
  link.href = href
  document.head.appendChild(link)
}

preloadFont(interFont)
preloadFont(balooFont)
preloadFont(monoFont)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
