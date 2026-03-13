'use client'

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getErrorMessage, type LoginInput } from '@/lib/app-data'
import type { User } from '@/lib/types'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isReady: boolean
  hasLoggedOut: boolean
  login: (input: LoginInput) => Promise<User | null>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const STORAGE_KEY = 'perfiliza-auth-user'
const LEGACY_STORAGE_KEY = 'talentai-auth-user'
const LOGOUT_FLAG_KEY = 'perfiliza-auth-logged-out'
const LEGACY_LOGOUT_FLAG_KEY = 'talentai-auth-logged-out'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [hasLoggedOut, setHasLoggedOut] = useState(false)

  useEffect(() => {
    const storedUser = window.localStorage.getItem(STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
    const storedLogoutFlag =
      window.sessionStorage.getItem(LOGOUT_FLAG_KEY) === 'true'
      || window.sessionStorage.getItem(LEGACY_LOGOUT_FLAG_KEY) === 'true'

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User)
        setHasLoggedOut(false)
        window.localStorage.removeItem(LEGACY_STORAGE_KEY)
        window.sessionStorage.removeItem(LEGACY_LOGOUT_FLAG_KEY)
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
        window.localStorage.removeItem(LEGACY_STORAGE_KEY)
        setHasLoggedOut(storedLogoutFlag)
      }
    } else {
      setHasLoggedOut(storedLogoutFlag)
    }

    setIsReady(true)
  }, [])

  useEffect(() => {
    if (!isReady) {
      return
    }

    if (user) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      return
    }

    window.localStorage.removeItem(STORAGE_KEY)
  }, [isReady, user])

  const login = useCallback(async (input: LoginInput) => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })

      const result = (await response.json()) as { user?: User; message?: string; errors?: unknown }

      if (!response.ok || !result.user) {
        throw new Error(getErrorMessage(result, 'Nao foi possivel autenticar o usuario.'))
      }

      window.sessionStorage.removeItem(LOGOUT_FLAG_KEY)

      startTransition(() => {
        setUser(result.user ?? null)
        setHasLoggedOut(false)
      })

      return result.user ?? null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    window.sessionStorage.setItem(LOGOUT_FLAG_KEY, 'true')
    startTransition(() => {
      setUser(null)
      setHasLoggedOut(true)
    })
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isReady,
        hasLoggedOut,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
