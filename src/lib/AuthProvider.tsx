import { getActiveUserId } from './db'
﻿import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
const AuthContext = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true })
export const useAuth = () => useContext(AuthContext)
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!!supabase)
  useEffect(() => {
    if (!supabase) return
    let active = true
    let authChanged = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      authChanged = true
      if (active) {
        if (getActiveUserId() && getActiveUserId() !== next?.user.id) {
          setSession(null); setLoading(true)
          // Keep the old database instance bound to old in-flight operations.
          // A new document opens the next account's database from scratch.
          window.location.replace('/')
          return
        }
        setSession(next); setLoading(false)
      }
    })
    void supabase.auth.getSession().then(({ data }) => {
      if (active && !authChanged) { setSession(data.session); setLoading(false) }
    }).catch(() => { if (active && !authChanged) setLoading(false) })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  return <AuthContext value={{ session, loading }}>{children}</AuthContext>
}
