'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '1rem',
      backgroundColor: '#1a1a1a',
      color: '#fff',
      fontFamily: 'monospace',
      padding: '2rem',
    }}>
      <h1 style={{ fontSize: '2rem', margin: 0 }}>⚠️ Application Error</h1>
      <p style={{ margin: '0.5rem 0', color: '#ccc' }}>
        An error occurred while processing your request.
      </p>
      {error.digest && (
        <code style={{
          backgroundColor: '#222',
          padding: '0.5rem 1rem',
          borderRadius: '0.25rem',
          color: '#0f0',
          fontSize: '0.875rem',
          marginTop: '1rem',
          maxWidth: '100%',
          overflow: 'auto',
        }}>
          {error.digest}
        </code>
      )}
      <button
        onClick={() => reset()}
        style={{
          marginTop: '1.5rem',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#0066cc',
          color: '#fff',
          border: 'none',
          borderRadius: '0.25rem',
          cursor: 'pointer',
          fontSize: '1rem',
        }}
      >
        Try Again
      </button>
    </div>
  )
}
