import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Rodape from './componentes/Rodape'
import ProtecaoImagens from './componentes/ProtecaoImagens'
import { lerSessao } from './lib/sessao-servidor'
import { padraoMarcaDagua } from './lib/marcaDagua'

// Sans-serif neutra no estilo Helvetica, usada em todo o site
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Catálogo de Produtos',
  description: 'Apresentação de coleções e referências',
  // Site com login: não aparece no Google
  robots: { index: false, follow: false },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Clientes (acesso temporário): marca d'água com o nome em todas as fotos e proteção contra download
  const sessao = await lerSessao()
  const cliente = sessao?.tipo === 'cliente'
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const estiloBody: React.CSSProperties & Record<string, string | number> = { margin: 0, padding: 0 }
  if (cliente) estiloBody['--marca-dagua'] = padraoMarcaDagua(`${sessao!.nome} · ${hoje}`)

  return (
    <html lang="pt-BR" className={inter.variable}>
      <body style={estiloBody} data-protegido={cliente ? 'sim' : undefined}>
        {cliente && <ProtecaoImagens />}
        {children}
        <Rodape />
      </body>
    </html>
  )
}