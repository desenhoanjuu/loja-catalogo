import FormEntrar from './FormEntrar'
import styles from './Entrar.module.css'

export const metadata = { title: 'Entrar · Catálogo' }

const AVISOS: Record<string, string> = {
  expirado: 'Seu acesso expirou ou foi encerrado. Peça um novo código ao seu vendedor.',
  master: 'A senha administrativa foi alterada. Entre de novo com a senha nova.',
}

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const p = await searchParams
  const aviso = p.confirmado ? 'E-mail confirmado! Agora é só entrar.' : (p.motivo && AVISOS[p.motivo]) || null

  return (
    <main className={styles.pagina}>
      <FormEntrar
        volta={p.volta || '/'}
        codigoInicial={p.codigo || ''}
        abaInicial={p.confirmado ? 'equipe' : 'cliente'}
        aviso={aviso}
      />
    </main>
  )
}
