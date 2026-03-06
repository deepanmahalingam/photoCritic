import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

// Fallback local auth when Supabase isn't configured
function useLocalAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('photocritic_user')
    if (saved) setUser(JSON.parse(saved))
    setLoading(false)
  }, [])

  const signUp = async (email, password) => {
    const u = { id: crypto.randomUUID(), email, created_at: new Date().toISOString() }
    const users = JSON.parse(localStorage.getItem('photocritic_users') || '{}')
    if (users[email]) throw new Error('An account with this email already exists')
    users[email] = { ...u, password }
    localStorage.setItem('photocritic_users', JSON.stringify(users))
    localStorage.setItem('photocritic_user', JSON.stringify(u))
    setUser(u)
    return u
  }

  const signIn = async (email, password) => {
    const users = JSON.parse(localStorage.getItem('photocritic_users') || '{}')
    const found = users[email]
    if (!found || found.password !== password) throw new Error('Invalid email or password')
    const u = { id: found.id, email: found.email, created_at: found.created_at }
    localStorage.setItem('photocritic_user', JSON.stringify(u))
    setUser(u)
    return u
  }

  const signOut = async () => {
    localStorage.removeItem('photocritic_user')
    setUser(null)
  }

  return { user, loading, signUp, signIn, signOut }
}

// Supabase auth
function useSupabaseAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data.user
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data.user
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { user, loading, signUp, signIn, signOut }
}

export function AuthProvider({ children }) {
  const auth = isSupabaseConfigured() ? useSupabaseAuth() : useLocalAuth()

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
