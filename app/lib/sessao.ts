// Sessão do site (equipe ou cliente), guardada num cookie assinado.
// Funciona no proxy e no servidor (usa a criptografia nativa do Web Crypto).

export const COOKIE_SESSAO = 'catalogo_sessao'

export interface Sessao {
  tipo: 'equipe' | 'cliente'
  id: string // equipe: id do usuário; cliente: id do acesso temporário
  nome: string // equipe: e-mail; cliente: nome do cliente
  exp: number // validade (segundos desde 1970)
}

const codificar = new TextEncoder()

function paraBase64Url(bytes: Uint8Array): string {
  let texto = ''
  bytes.forEach((b) => (texto += String.fromCharCode(b)))
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deBase64Url(texto: string): Uint8Array<ArrayBuffer> {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/')
  const bruto = atob(normal + '==='.slice((normal.length + 3) % 4))
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0))
}

async function chaveSecreta(): Promise<CryptoKey> {
  const segredo = process.env.SESSAO_SEGREDO
  if (!segredo || segredo.length < 20) {
    throw new Error('Configure a variável SESSAO_SEGREDO na Vercel (texto aleatório com 20+ caracteres).')
  }
  return crypto.subtle.importKey('raw', codificar.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

export async function assinarSessao(sessao: Sessao): Promise<string> {
  const corpo = paraBase64Url(codificar.encode(JSON.stringify(sessao)))
  const assinatura = new Uint8Array(await crypto.subtle.sign('HMAC', await chaveSecreta(), codificar.encode(corpo)))
  return `${corpo}.${paraBase64Url(assinatura)}`
}

export async function verificarSessao(token: string | null | undefined): Promise<Sessao | null> {
  if (!token) return null
  try {
    const [corpo, assinatura] = token.split('.')
    if (!corpo || !assinatura) return null
    const valida = await crypto.subtle.verify(
      'HMAC',
      await chaveSecreta(),
      deBase64Url(assinatura),
      codificar.encode(corpo)
    )
    if (!valida) return null
    const sessao = JSON.parse(new TextDecoder().decode(deBase64Url(corpo))) as Sessao
    if (!sessao.exp || sessao.exp * 1000 <= Date.now()) return null
    return sessao
  } catch {
    return null
  }
}

// Código de acesso: só letras e números, sem traço/espaço, em maiúsculas
export function normalizarCodigo(codigo: string): string {
  return String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// O banco guarda só o "hash" do código, nunca o código em si
export async function hashCodigo(codigo: string): Promise<string> {
  const segredo = process.env.SESSAO_SEGREDO || ''
  const resumo = await crypto.subtle.digest('SHA-256', codificar.encode(`${segredo}:${normalizarCodigo(codigo)}`))
  return Array.from(new Uint8Array(resumo))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ---------- Senha master (donos) ----------
// A senha fica só na variável SENHA_MASTER da Vercel. A sessão guarda uma "impressão" dela:
// se a senha for trocada, quem entrou com a antiga é desconectado.
async function resumo(texto: string): Promise<string> {
  const r = await crypto.subtle.digest('SHA-256', codificar.encode(texto))
  return Array.from(new Uint8Array(r))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function senhaMasterConfigurada(): boolean {
  return (process.env.SENHA_MASTER || '').length >= 8
}

export async function impressaoMaster(): Promise<string> {
  return (await resumo(`${process.env.SESSAO_SEGREDO || ''}:master:${process.env.SENHA_MASTER || ''}`)).slice(0, 24)
}

// Compara pelo resumo das duas senhas (mesmo tempo de resposta para qualquer tentativa)
export async function senhaMasterConfere(tentativa: string): Promise<boolean> {
  if (!senhaMasterConfigurada()) return false
  const [a, b] = await Promise.all([
    resumo(`master:${String(tentativa || '')}`),
    resumo(`master:${process.env.SENHA_MASTER}`),
  ])
  let diferenca = 0
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferenca === 0
}

export const DOMINIO_EQUIPE = '@anjuu.com.br'

export function emailDaEquipe(email: string): boolean {
  return String(email || '').trim().toLowerCase().endsWith(DOMINIO_EQUIPE)
}
