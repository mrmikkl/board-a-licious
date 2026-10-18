import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext<(message: string) => void>(() => undefined)

/** One short sentence above the tab bar; screen readers hear it too. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const show = useCallback((text: string) => {
    setMessage(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), 2600)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={`toast${message ? ' show' : ''}`} role="status" aria-live="polite">
        {message && (
          <>
            <i className="hex" aria-hidden="true" />
            {message}
          </>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
