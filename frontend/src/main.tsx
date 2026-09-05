import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { DisplayProvider } from './auth/DisplayContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DisplayProvider>
          <App />
        </DisplayProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)