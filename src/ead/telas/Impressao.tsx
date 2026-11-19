// Impressao.tsx → /ead/imprimir/:tipo/:chave — ITEM 7 DO LOTE 2.
//
// POR QUE PÁGINA PRÓPRIA E window.print() EM VEZ DE BIBLIOTECA DE PDF:
// o pedido é explícito, e a razão prática é boa — gerar PDF no navegador com
// biblioteca significa empacotar mais centenas de KB e reproduzir a tipografia
// à mão. A impressão do navegador usa as fontes do sistema, respeita A4 e o
// aluno escolhe "Salvar como PDF". Uma página com CSS de impressão resolve os
// três documentos (certificado, pré-diagnóstico, anotações) sem dependência nova.
//
// TIPOS: certificado | prediagnostico | anotacoes
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, apiLote2, ErroApi } from '../api'

type Tipo = 'certificado' | 'prediagnostico' | 'anotacoes'

export default function Impressao() {
  const { tipo = '', chave = '' } = useParams<{ tipo: string; chave: string }>()
  const t = (['certificado', 'prediagnostico', 'anotacoes'].includes(tipo) ? tipo : '') as Tipo | ''

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState<any>(null)

  const carregar = useCallback(async () => {
    if (!t) {
      setErro('Documento desconhecido.')
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro('')
    try {
      if (t === 'certificado') {
        // A rota pública devolve o que precisa; a assinatura NÃO vem por aqui
        // (item 6 do comando: a validação pública não mostra a rubrica).
        setDados(await api.verificarCertificado(chave))
      } else if (t === 'prediagnostico') {
        setDados(await apiLote2.prediagnostico(chave))
      } else {
        setDados(await api.anotacoesDoCurso(chave))
      }
    } catch (err) {
      if (err instanceof ErroApi && err.status === 401) {
        setErro('Entre na sua conta para abrir este documento.')
      } else if (err instanceof ErroApi && err.status === 404) {
        setErro('Documento não encontrado.')
      } else {
        setErro('Não foi possível abrir o documento agora.')
      }
    } finally {
      setCarregando(false)
    }
  }, [t, chave])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Imprime sozinho quando o documento terminou de carregar. `setTimeout` curto
  // porque a folha precisa de um frame para aplicar o CSS antes do diálogo.
  useEffect(() => {
    if (carregando || erro || !dados) return
    const id = setTimeout(() => window.print(), 400)
    return () => clearTimeout(id)
  }, [carregando, erro, dados])

  if (carregando)
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Preparando o documento…</p>
      </div>
    )

  if (erro)
    return (
      <div className="p-8">
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Volte para a tela anterior e tente de novo.
        </p>
      </div>
    )

  return (
    <div className="folha">
      <style>{CSS_IMPRESSAO}</style>

      {t === 'certificado' && <CertificadoDoc c={dados} />}
      {t === 'prediagnostico' && <PreDiagnosticoDoc r={dados} />}
      {t === 'anotacoes' && <AnotacoesDoc d={dados} />}

      <p className="nao-imprimir mt-8 text-center text-xs text-muted-foreground">
        Se o diálogo de impressão não abrir, use Ctrl+P (ou Cmd+P no Mac) e escolha “Salvar como
        PDF”.
      </p>
    </div>
  )
}

// CSS de impressão: A4, margens, sem cabeçalho de navegador.
const CSS_IMPRESSAO = `
  .folha { max-width: 190mm; margin: 0 auto; padding: 16px; font-family: Inter, system-ui, -apple-system, sans-serif; color: #111; }
  .folha h1 { font-size: 22px; margin: 0 0 4px; }
  .folha h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .06em; color: #555; margin: 18px 0 6px; }
  .folha p, .folha li { font-size: 12.5px; line-height: 1.55; }
  .folha .rodape { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 10.5px; color: #666; }
  @media print {
    @page { size: A4; margin: 18mm 16mm; }
    .nao-imprimir { display: none !important; }
    .folha { max-width: none; padding: 0; }
  }
`

function CertificadoDoc({ c }: { c: any }) {
  if (!c) return null
  return (
    <article>
      <p
        style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#666' }}
      >
        Certificado de conclusão
      </p>
      <h1 style={{ fontSize: 26, marginTop: 20 }}>{c.nome}</h1>
      <p style={{ marginTop: 2, color: '#444' }}>concluiu o curso</p>
      <p style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{c.curso}</p>

      <h2>Carga horária</h2>
      <p>{c.carga_horas ? `${c.carga_horas} horas` : '—'}</p>

      <h2>Conclusão</h2>
      <p>
        {c.data}
        {c.cidade ? ` · ${c.cidade}` : ''}
      </p>

      <h2>Validação</h2>
      <p>
        Código <strong>{c.codigo}</strong>
        <br />
        Confira em /certificado/{c.codigo}
      </p>

      {c.assinante_nome && (
        <div style={{ marginTop: 40 }}>
          <p style={{ borderTop: '1px solid #999', paddingTop: 6, width: 260 }}>
            <strong>{c.assinante_nome}</strong>
            {c.assinante_cargo ? (
              <>
                <br />
                {c.assinante_cargo}
              </>
            ) : null}
          </p>
        </div>
      )}

      <p className="rodape">
        Documento gerado pelo EAD do livro Guia Masterclass de Implementação WMS. A autenticidade
        pode ser conferida pelo código acima.
      </p>
    </article>
  )
}

function PreDiagnosticoDoc({ r }: { r: any }) {
  const pd = r?.prediagnostico
  if (!pd) return <p>Pré-diagnóstico não encontrado para este curso.</p>
  const s = pd.snapshot || {}
  return (
    <article>
      <p
        style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#666' }}
      >
        Pré-diagnóstico da operação
      </p>
      <h1 style={{ fontSize: 22, marginTop: 14 }}>{r.curso}</h1>
      <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{pd.codigo}</p>

      <h2>Maturidade estimada</h2>
      <p>
        <strong>{pd.nivel}</strong> de 5{s.nivel?.texto ? ` — ${s.nivel.texto}` : ''}
      </p>

      <h2>Perfil</h2>
      <p>
        Controle atual: {s.perfil?.controle_atual || '—'}
        <br />
        Papel: {s.perfil?.papel || '—'} · Porte: {s.perfil?.porte || '—'}
      </p>

      <h2>Pontos de atenção</h2>
      <ul>
        {(s.pontos_de_atencao || []).map((p: any, i: number) => (
          <li key={i} style={{ marginBottom: 8 }}>
            <strong>{p.dor}</strong>
            {p.texto ? ` — ${p.texto}` : ''}
            {p.aula_base ? ` (aula base: ${p.aula_base.numero} — ${p.aula_base.titulo})` : ''}
          </li>
        ))}
      </ul>

      {s.proximo_passo && (
        <>
          <h2>Próximo passo sugerido</h2>
          <p>{s.proximo_passo}</p>
        </>
      )}

      <p className="rodape">
        Leitura a partir das respostas do aluno. Não mede a operação nem substitui análise com dados
        reais.
      </p>
    </article>
  )
}

function AnotacoesDoc({ d }: { d: any }) {
  const itens = d?.anotacoes ?? []
  return (
    <article>
      <p
        style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#666' }}
      >
        Anotações do curso
      </p>
      <h1 style={{ fontSize: 22, marginTop: 14 }}>{d?.curso_titulo || 'Curso'}</h1>
      <p style={{ color: '#555' }}>{itens.length} resposta(s) do “Para fixar”.</p>

      {itens.map((a: any, i: number) => (
        <div key={i} style={{ marginTop: 16, breakInside: 'avoid' }}>
          <h2 style={{ marginBottom: 2 }}>
            {a.numero} — {a.titulo}
          </h2>
          {a.pergunta && <p style={{ color: '#555', fontStyle: 'italic' }}>{a.pergunta}</p>}
          <p style={{ whiteSpace: 'pre-line' }}>{a.resposta}</p>
        </div>
      ))}

      {!itens.length && <p>Nenhuma anotação registrada ainda.</p>}

      <p className="rodape">Documento pessoal. Não é material do curso.</p>
    </article>
  )
}
