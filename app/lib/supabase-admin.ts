import { createClient } from '@supabase/supabase-js'

// Cliente com a chave secreta do Supabase. Só pode ser usado no servidor (nunca em componente 'use client').
export function supabaseAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chave) throw new Error('Configure a variável SUPABASE_SERVICE_ROLE_KEY na Vercel.')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Cliente comum, só para login/cadastro da equipe (Supabase Auth)
export function supabaseAuth() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
