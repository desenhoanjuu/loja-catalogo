import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import GaleriaProduto from './GaleriaProduto'
import styles from './GaleriaProduto.module.css'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const revalidate = 0

export default async function PaginaProduto({
  params,
}: {
  params: Promise<{ referencia: string }>
}) {
  const { referencia } = await params
  const r2BaseUrl = process.env.NEXT_PUBLIC_R2_URL || ''

  const { data: produto, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('referencia', referencia)
    .single()

  if (error || !produto) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        <p style={{ color: '#4b5563', marginBottom: '16px' }}>
          Referência {referencia} não encontrada.
        </p>
        <Link href="/" style={{ color: '#ea580c', fontWeight: 600, textDecoration: 'none' }}>
          ← Voltar ao catálogo
        </Link>
      </div>
    )
  }

  return (
    <main className={styles.container}>
      {/* Breadcrumb idêntico ao topo da referência */}
      <nav className={styles.breadcrumb}>
        <Link href="/">Home</Link>
        {produto.departamento && (
          <>
            <span>→</span>
            <span>{produto.departamento}</span>
          </>
        )}
        {produto.grupo && (
          <>
            <span>→</span>
            <span>{produto.grupo}</span>
          </>
        )}
        <span>→</span>
        <span className={styles.breadcrumbAtual}>
          {produto.descricao || `Referência ${produto.referencia}`}
        </span>
      </nav>

      <GaleriaProduto
        referencia={produto.referencia}
        descricao={produto.descricao}
        marca={produto.marca}
        estoque={produto.estoque_pe}
        tipoPeca={produto.tipo_peca}
        grade={produto.grade}
        composicao={produto.composicao}
        fotosPorCor={produto.fotos || {}}
        r2BaseUrl={r2BaseUrl}
      />
    </main>
  )
}