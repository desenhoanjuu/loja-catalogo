import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Rodape from './componentes/Rodape'

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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body style={{ margin: 0, padding: 0 }}>
        {children}
        <Rodape />
      </body>
    </html>
  )
}