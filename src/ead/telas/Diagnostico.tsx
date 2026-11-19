// Diagnostico.tsx → /ead/:cursoSlug/diagnostico
//
// ITEM 3 DO LOTE 2. É a tela que transforma "ganhou um curso" em dado útil.
//
// POR QUE É OBRIGATÓRIA: o servidor recusa playback e progresso com 409
// `diagnostico_pendente` enquanto não houver diagnóstico. Esta tela é o caminho
// para sair do 409 — e toda tela de curso que receber esse código redireciona
// para cá.
//
// SEM "PULAR": o pedido é explícito. O botão fica desabilitado até as 5 respostas,
// e o rodapé diz quantas faltam. Um botão de pular aqui esvaziaria o único dado
// que o curso coleta sobre o aluno.
//
// ACESSIBILIDADE DAS ESCOLHAS: são botões com aria-pressed, não selects — em
// 390 px um select nativo esconde as opções atrás de uma rolagem do sistema e
// não mostra o estado marcado. aria-pressed é o que anuncia "escolhido" ao
// leitor de tela.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiLote2, ErroApi, type Dor } from '../api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

// RÓTULOS COMO NO MOCKUP. As CHAVES são as do banco (select) e não podem
// mudar; os textos são os do desenho aprovado, mais próximos da fala do dono.
const TIPOS_OPERACAO = [
  { v: '3pl', r: 'Operador logístico (3PL)' },
  { v: 'armazem_geral', r: 'Armazém geral' },
  { v: 'cd_proprio', r: 'CD próprio (indústria ou varejo)' },
  { v: 'ecommerce', r: 'E-commerce / fulfillment' },
  { v: 'outro', r: 'Outro' },
]

const CONTROLES = [
  { v: 'planilha', r: 'Planilhas e papel' },
  { v: 'erp', r: 'Módulo de estoque do ERP' },
  { v: 'wms_mercado', r: 'WMS de mercado' },
  { v: 'sistema_proprio', r: 'Sistema desenvolvido internamente' },
  { v: 'implantando', r: 'Estamos implantando um WMS' },
]

const PAPEIS = [
  { v: 'diretoria', r: 'Diretoria ou sócio' },
  { v: 'gerencia', r: 'Gerência de logística ou operações' },
  { v: 'supervisao', r: 'Supervisão ou coordenação' },
  { v: 'ti', r: 'TI ou sistemas' },
  { v: 'consultoria', r: 'Consultoria' },
  { v: 'outro', r: 'Outro' },
]

const PORTES = [
  { v: 'ate_2mil', r: 'Até 2 mil m²' },
  { v: 'de_2a10mil', r: '2 a 10 mil m²' },
  { v: 'de_10a30mil', r: '10 a 30 mil m²' },
  { v: 'acima_30mil', r: 'Mais de 30 mil m²' },
]

const VERSAO_ACEITE = 'contato-2026-11'

export default function Diagnostico() {
  const { cursoSlug = '' } = useParams<{ cursoSlug: string }>()
  const navegar = useNavigate()

  const [dores, setDores] = useState<Dor[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')

  const [tipo, setTipo] = useState('')
  const [controle, setControle] = useState('')
  const [doresEscolhidas, setDoresEscolhidas] = useState<string[]>([])
  const [papel, setPapel] = useState('')
  const [porte, setPorte] = useState('')
  const [aceite, setAceite] = useState(false)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErroCarga('')
    try {
      const r = await apiLote2.diagnostico(cursoSlug)
      setDores(r.dores ?? [])
      // Já respondeu antes? Reaproveita, para ele poder ajustar em vez de
      // preencher tudo de novo.
      if (r.existe && r.diagnostico) {
        setTipo(r.diagnostico.tipo_operacao || '')
        setControle(r.diagnostico.controle_atual || '')
        setDoresEscolhidas(r.diagnostico.dores || [])
        setPapel(r.diagnostico.papel || '')
        setPorte(r.diagnostico.porte || '')
        setAceite(!!r.diagnostico.aceite_contato)
      }
    } catch (err) {
      if (err instanceof ErroApi && err.status === 401) {
        navegar(`/ead/entrar?voltar=/ead/${cursoSlug}/diagnostico`, { replace: true })
        return
      }
      if (err instanceof ErroApi && err.status === 403) {
        setErroCarga('Você precisa ter acesso a este curso para responder.')
        return
      }
      setErroCarga('Não foi possível carregar o diagnóstico agora.')
    } finally {
      setCarregando(false)
    }
  }, [cursoSlug, navegar])

  useEffect(() => {
    carregar()
  }, [carregar])

  const respondidas = useMemo(() => {
    let n = 0
    if (tipo) n++
    if (controle) n++
    if (doresEscolhidas.length > 0) n++
    if (papel) n++
    if (porte) n++
    return n
  }, [tipo, controle, doresEscolhidas, papel, porte])

  function alternarDor(id: string) {
    setDoresEscolhidas((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id)
      if (atual.length >= 2) return atual // máximo 2: o servidor recusa o 3º
      return [...atual, id]
    })
  }

  // Aula recomendada: vem do SERVIDOR, que aplica a mesma regra do
  // pré-diagnóstico (porta de entrada; sem ela, a de menor ordem). Calcular na
  // tela daria uma segunda implementação da regra, e as duas divergiriam.
  const [aulaRecomendada, setAulaRecomendada] = useState<{
    numero: string
    titulo: string
    modulo: string
    slug: string
  } | null>(null)

  useEffect(() => {
    if (doresEscolhidas.length === 0) {
      setAulaRecomendada(null)
      return
    }
    let vivo = true
    ;(async () => {
      try {
        const r = await apiLote2.aulaDaDor(doresEscolhidas[0], cursoSlug)
        if (vivo && r.encontrada && r.aula) setAulaRecomendada(r.aula)
      } catch {
        if (vivo) setAulaRecomendada(null)
      }
    })()
    return () => {
      vivo = false
    }
  }, [doresEscolhidas, cursoSlug])

  const temDorMarcada = doresEscolhidas.length > 0

  async function enviar() {
    setErro('')
    if (respondidas < 5) {
      setErro('Todas as 5 perguntas são obrigatórias.')
      return
    }
    setSalvando(true)
    try {
      await apiLote2.salvarDiagnostico({
        curso: cursoSlug,
        tipo_operacao: tipo,
        controle_atual: controle,
        dores: doresEscolhidas,
        papel,
        porte,
        aceite_contato: aceite,
        aceite_texto_versao: VERSAO_ACEITE,
      })
      navegar(`/ead/minha-area`)
    } catch (err) {
      if (err instanceof ErroApi && err.status === 409) {
        // Já tem diagnóstico: não é erro, é seguir.
        navegar(`/ead/minha-area`)
        return
      }
      setErro(
        err instanceof ErroApi ? err.message : 'Não foi possível salvar agora. Tente de novo.',
      )
    } finally {
      setSalvando(false)
    }
  }

  if (carregando)
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="mt-6 h-8 w-3/4 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    )

  if (erroCarga)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Não conseguimos abrir o diagnóstico</h1>
        <p className="mt-2 text-muted-foreground">{erroCarga}</p>
        <Button variant="outline" className="mt-6 h-11" onClick={carregar}>
          Tentar de novo
        </Button>
      </div>
    )

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {/* Etapas */}
      <ol className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
        <li className="flex items-center gap-1.5 text-primary">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
            ✓
          </span>
          Acesso ativado
        </li>
        <li aria-hidden="true" className="text-muted-foreground/50">
          →
        </li>
        <li className="flex items-center gap-1.5 text-primary">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
            2
          </span>
          Sua operação
        </li>
        <li aria-hidden="true" className="text-muted-foreground/50">
          →
        </li>
        <li className="flex items-center gap-1.5">
          <span className="grid h-5 w-5 place-items-center rounded-full border text-[10px]">3</span>
          Primeira aula
        </li>
      </ol>

      <h1 className="mt-6 text-2xl font-bold leading-snug sm:text-3xl">
        Antes da primeira aula: 5 perguntas sobre a sua operação
      </h1>
      <p className="mt-3 text-muted-foreground">
        Suas respostas montam o seu pré-diagnóstico no fim do curso e fazem o professor falar da sua
        realidade, não de um armazém genérico. Leva menos de dois minutos.
      </p>

      <div className="mt-8 space-y-8">
        <Pergunta n={1} titulo="Como é a sua operação hoje?">
          <Escolhas
            opcoes={TIPOS_OPERACAO}
            valor={tipo}
            onChange={setTipo}
            grupo="tipo de operação"
          />
        </Pergunta>

        <Pergunta n={2} titulo="Como a operação é controlada hoje?">
          <Escolhas opcoes={CONTROLES} valor={controle} onChange={setControle} grupo="controle" />
        </Pergunta>

        <Pergunta n={3} titulo="Qual é a maior dor da operação hoje? (até duas)">
          {dores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma dor disponível no momento.</p>
          ) : (
            <Escolhas
              opcoes={dores.map((d) => ({ v: d.id, r: d.nome }))}
              valor={doresEscolhidas}
              onChange={alternarDor}
              grupo="maior dor"
              multiplo
            />
          )}

          {/* Aviso laranja. Texto do mockup: nomeia a aula e o módulo, e fecha
              dizendo que o curso inteiro segue liberado — sem essa segunda
              frase, escolher "a maior" dor parece fechar as outras aulas. */}
          {temDorMarcada && (
            <div
              role="status"
              className="mt-3 rounded-lg border-l-4 border-accent bg-accent/10 px-4 py-3 text-sm"
            >
              {aulaRecomendada ? (
                <>
                  <p>
                    Para essa dor, comece pela{' '}
                    <strong>
                      {aulaRecomendada.numero}: {aulaRecomendada.titulo}
                    </strong>{' '}
                    ({aulaRecomendada.modulo}).
                  </p>
                  <p className="mt-1 font-medium">O curso inteiro continua liberado.</p>
                </>
              ) : (
                <p>
                  O curso inteiro continua liberado. A sua trilha abre pela aula da dor marcada.
                </p>
              )}
            </div>
          )}
        </Pergunta>

        <Pergunta n={4} titulo="Qual é o seu papel na operação?">
          <Escolhas opcoes={PAPEIS} valor={papel} onChange={setPapel} grupo="papel" />
        </Pergunta>

        <Pergunta n={5} titulo="Qual é o tamanho da área de armazenagem?">
          <Escolhas opcoes={PORTES} valor={porte} onChange={setPorte} grupo="porte" />
        </Pergunta>

        {/* Aceite: SEPARADO das perguntas, desmarcado por padrão. */}
        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="aceite-contato"
              checked={aceite}
              onCheckedChange={(v) => setAceite(v === true)}
              className="mt-0.5 h-5 w-5"
            />
            <div>
              <Label htmlFor="aceite-contato" className="text-sm font-normal leading-relaxed">
                Aceito que Eduardo Canal e a Zionlogtec usem estas respostas para conversar comigo
                sobre a minha operação.
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Opcional e separado das perguntas. Sem marcar, as respostas servem só para o seu
                curso e o seu pré-diagnóstico.
              </p>
            </div>
          </div>
        </section>
      </div>

      {erro && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="sticky bottom-0 mt-8 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-b-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{respondidas} de 5</strong> respondidas • todas são
            obrigatórias
          </p>
          <Button
            className="h-11 w-full sm:w-auto"
            onClick={enviar}
            disabled={respondidas < 5 || salvando}
          >
            {salvando
              ? 'Salvando…'
              : respondidas < 5
                ? 'Responda as 5 para continuar'
                : 'Ver minha trilha'}
          </Button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link to={`/ead/${cursoSlug}`} className="underline">
          Ver a página do curso
        </Link>
      </p>
    </div>
  )
}

function Pergunta({
  n,
  titulo,
  children,
}: {
  n: number
  titulo: string
  children: React.ReactNode
}) {
  return (
    <fieldset>
      <legend className="text-base font-semibold">
        <span className="mr-2 text-primary">{n}.</span>
        {titulo}
      </legend>
      <div className="mt-3">{children}</div>
    </fieldset>
  )
}

function Escolhas({
  opcoes,
  valor,
  onChange,
  grupo,
  multiplo = false,
}: {
  opcoes: Array<{ v: string; r: string }>
  valor: string | string[]
  onChange: (v: any) => void
  grupo: string
  multiplo?: boolean
}) {
  return (
    <div role="group" aria-label={grupo} className="flex flex-wrap gap-2">
      {opcoes.map((o) => {
        const marcado = multiplo ? Array.isArray(valor) && valor.includes(o.v) : valor === o.v
        return (
          <button
            key={o.v}
            type="button"
            aria-pressed={marcado}
            onClick={() => onChange(o.v)}
            className={
              'min-h-11 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ' +
              (marcado
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted')
            }
          >
            {o.r}
          </button>
        )
      })}
    </div>
  )
}
