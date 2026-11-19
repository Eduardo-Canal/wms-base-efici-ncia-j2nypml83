// ConteudoDores.tsx — cartões do comando 3, item 2 que faltam na tela de
// Conteúdo: catálogo de dores, atendimento comercial e regras do pré-diagnóstico.
//
// POR QUE UM ARQUIVO SEPARADO: `Conteudo.tsx` já tem 24 KB e cuida de
// curso/módulo/aula. Enfiar três cartões novos lá dentro deixaria o arquivo
// ilegível e aumentaria o risco de quebrar a edição de aula, que é o que o dono
// usa todo dia. Aqui é aditivo: Admin.tsx renderiza este componente ao lado.
import { useCallback, useEffect, useState } from 'react'
import { apiLote2, api, ErroApi, getToken } from '../api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

type DorAdmin = { id: string; nome: string; ativo: boolean; texto: string; aulas: number }

export default function ConteudoDores() {
  // ---------------- catálogo ----------------
  const [dores, setDores] = useState<DorAdmin[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [editando, setEditando] = useState<DorAdmin | null>(null)
  const [novaDor, setNovaDor] = useState(false)

  // ---------------- atendimento ----------------
  const [whats, setWhats] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [salvandoAtend, setSalvandoAtend] = useState(false)
  const [okAtend, setOkAtend] = useState('')

  // ---------------- regras ----------------
  const [maturidade, setMaturidade] = useState<Record<string, string>>({})
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [proximos, setProximos] = useState<Record<string, string>>({})
  const [salvandoRegras, setSalvandoRegras] = useState(false)
  const [okRegras, setOkRegras] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const r = await apiLote2.adminDores()
      setDores(r.dores ?? [])
    } catch (err) {
      setErro(
        err instanceof ErroApi && err.status === 403
          ? 'Só o administrador vê o catálogo.'
          : 'Não foi possível carregar o catálogo de dores.',
      )
    } finally {
      setCarregando(false)
    }

    // config: atendimento + regras
    try {
      const cfg = await api.adminConfig()
      const c: any = cfg
      setWhats(c.whatsapp_atendimento ?? '')
      setMensagem(c.mensagem_whatsapp ?? '')
      // Os três JSONs viram formulários de campos normais — nada de textarea
      // com JSON cru: um erro de vírgula deixaria o pré-diagnóstico sem texto.
      const mat = c.maturidade_por_controle ?? {}
      const txt = c.textos_maturidade ?? {}
      const prox = c.proximo_passo_por_momento ?? {}
      setMaturidade({
        planilha: String(mat.planilha ?? ''),
        erp: String(mat.erp ?? ''),
        wms_mercado: String(mat.wms_mercado ?? ''),
        sistema_proprio: String(mat.sistema_proprio ?? ''),
        implantando: String(mat.implantando ?? ''),
      })
      setTextos({
        '1': String(txt['1'] ?? ''),
        '2': String(txt['2'] ?? ''),
        '3': String(txt['3'] ?? ''),
        '4': String(txt['4'] ?? ''),
        '5': String(txt['5'] ?? ''),
      })
      setProximos({
        estudando: String(prox.estudando ?? ''),
        avaliando: String(prox.avaliando ?? ''),
        projeto_aprovado: String(prox.projeto_aprovado ?? ''),
        tem_wms: String(prox.tem_wms ?? ''),
      })
    } catch {
      /* o dono vê os campos vazios; o cartão avisa ao salvar */
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function salvarDor() {
    if (!editando) return
    setErro('')
    try {
      await apiLote2.adminSalvarDor({
        id: editando.id || undefined,
        nome: editando.nome,
        ativo: editando.ativo,
        texto_prediagnostico: editando.texto,
      })
      setEditando(null)
      setNovaDor(false)
      await carregar()
    } catch (err) {
      setErro(
        err instanceof ErroApi && err.status === 409
          ? 'Já existe uma dor com este nome.'
          : 'Não foi possível salvar a dor.',
      )
    }
  }

  async function salvarAtendimento() {
    setSalvandoAtend(true)
    setOkAtend('')
    try {
      await api.adminSalvarConfig({
        whatsapp_atendimento: whats.replace(/\D/g, ''),
        mensagem_whatsapp: mensagem,
      } as any)
      setOkAtend('Salvo.')
      setTimeout(() => setOkAtend(''), 2500)
    } catch {
      setOkAtend('Não foi possível salvar.')
    } finally {
      setSalvandoAtend(false)
    }
  }

  async function salvarRegras() {
    setSalvandoRegras(true)
    setOkRegras('')
    try {
      // Números nos níveis; texto nos demais.
      const mat: Record<string, number> = {}
      Object.keys(maturidade).forEach((k) => {
        const n = parseInt(maturidade[k], 10)
        if (!isNaN(n)) mat[k] = Math.min(5, Math.max(1, n))
      })
      await api.adminSalvarConfig({
        maturidade_por_controle: mat,
        textos_maturidade: textos,
        proximo_passo_por_momento: proximos,
      } as any)
      setOkRegras('Salvo.')
      setTimeout(() => setOkRegras(''), 2500)
    } catch {
      setOkRegras('Não foi possível salvar.')
    } finally {
      setSalvandoRegras(false)
    }
  }

  // mensagem de teste com dados de exemplo
  const exemploMsg = mensagem
    .split('{nome}')
    .join('Marina')
    .split('{empresa}')
    .join('Logística Exemplo')
    .split('{curso}')
    .join('WMS: Fundamentos e Integrações')
    .split('{codigo}')
    .join('PD-A1B2')

  return (
    <div className="mt-10 space-y-10">
      {/* ---------------- catálogo de dores ---------------- */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Catálogo de dores</h2>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => {
              setNovaDor(true)
              setEditando({ id: '', nome: '', ativo: true, texto: '', aulas: 0 })
            }}
          >
            Nova dor
          </Button>
        </div>

        {carregando ? (
          <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
        ) : erro ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {erro}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {dores.map((d) => (
              <li
                key={d.id}
                className={
                  'flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 ' +
                  (d.aulas === 0 ? 'border-accent/60' : '')
                }
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {d.nome}
                    {!d.ativo && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        inativa
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.aulas > 0
                      ? `${d.aulas} aula${d.aulas === 1 ? '' : 's'}`
                      : 'Sem aula · fora do diagnóstico'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="h-11"
                  onClick={() => {
                    setNovaDor(false)
                    setEditando(d)
                  }}
                >
                  Editar
                </Button>
              </li>
            ))}
          </ul>
        )}

        {editando && (
          <div className="mt-4 rounded-xl border bg-muted/40 p-4">
            <h3 className="text-sm font-semibold">{novaDor ? 'Nova dor' : 'Editar dor'}</h3>
            <div className="mt-3 space-y-3">
              <div>
                <Label htmlFor="dor-nome">Nome</Label>
                <Input
                  id="dor-nome"
                  value={editando.nome}
                  onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                  className="mt-1 h-11"
                />
              </div>
              <div>
                <Label htmlFor="dor-texto">Texto no pré-diagnóstico</Label>
                <Textarea
                  id="dor-texto"
                  value={editando.texto}
                  onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
                  maxLength={600}
                  className="mt-1 min-h-20"
                  placeholder="Uma frase sobre o que essa dor significa na prática."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Em branco, o pré-diagnóstico mostra só o nome da dor.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="dor-ativa"
                  checked={editando.ativo}
                  onCheckedChange={(v) => setEditando({ ...editando, ativo: v === true })}
                  className="mt-0.5 h-5 w-5"
                />
                <Label htmlFor="dor-ativa" className="text-sm font-normal">
                  Ativa (aparece na pergunta 3 do diagnóstico)
                </Label>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="h-11" onClick={salvarDor}>
                Salvar
              </Button>
              <Button
                variant="outline"
                className="h-11"
                onClick={() => {
                  setEditando(null)
                  setNovaDor(false)
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ---------------- atendimento comercial ---------------- */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-base font-semibold">Atendimento comercial</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          É o número que o aluno recebe ao clicar em “Falar com a Zion no WhatsApp” na tela de
          conclusão.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="whats">WhatsApp de atendimento</Label>
            <Input
              id="whats"
              inputMode="tel"
              value={whats}
              onChange={(e) => setWhats(e.target.value)}
              placeholder="5511999999999"
              className="mt-1 h-11 font-mono"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Só dígitos, com DDI. Ex.: 55 11 99999-9999 → 5511999999999
            </p>
          </div>
        </div>

        <div className="mt-3">
          <Label htmlFor="msg-whats">Mensagem inicial</Label>
          <Textarea
            id="msg-whats"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            maxLength={1000}
            className="mt-1 min-h-24"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Campos disponíveis: <code>{'{nome}'}</code> <code>{'{empresa}'}</code>{' '}
            <code>{'{curso}'}</code> <code>{'{codigo}'}</code>
          </p>
        </div>

        {exemploMsg && (
          <div className="mt-3 rounded-lg bg-muted p-3 text-xs">
            <p className="font-medium text-muted-foreground">Como chega no WhatsApp:</p>
            <p className="mt-1 whitespace-pre-line">{exemploMsg}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button className="h-11" onClick={salvarAtendimento} disabled={salvandoAtend}>
            {salvandoAtend ? 'Salvando…' : 'Salvar'}
          </Button>
          {whats.replace(/\D/g, '') && exemploMsg && (
            <Button asChild variant="outline" className="h-11">
              <a
                href={`https://wa.me/${whats.replace(/\D/g, '')}?text=${encodeURIComponent(exemploMsg)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Testar no WhatsApp
              </a>
            </Button>
          )}
          {okAtend && <span className="text-sm text-muted-foreground">{okAtend}</span>}
        </div>
        {!whats.replace(/\D/g, '') && (
          <p className="mt-2 text-xs text-amber-700">
            Sem número, o botão da tela de conclusão responde “ainda não configurado”.
          </p>
        )}
      </section>

      {/* ---------------- regras do pré-diagnóstico ---------------- */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-base font-semibold">Regras do pré-diagnóstico</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Como o pré-diagnóstico lê as respostas do aluno. Estes textos aparecem no resultado.
        </p>

        <h3 className="mt-4 text-sm font-semibold">Nível por forma de controle (1 a 5)</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            ['planilha', 'Planilhas e papel'],
            ['erp', 'Módulo de estoque do ERP'],
            ['wms_mercado', 'WMS de mercado'],
            ['sistema_proprio', 'Sistema próprio'],
            ['implantando', 'Em implantação'],
          ].map(([k, rotulo]) => (
            <div key={k} className="flex items-center gap-2">
              <Label htmlFor={`mat-${k}`} className="min-w-0 flex-1 text-xs">
                {rotulo}
              </Label>
              <Input
                id={`mat-${k}`}
                type="number"
                min={1}
                max={5}
                value={maturidade[k] ?? ''}
                onChange={(e) => setMaturidade({ ...maturidade, [k]: e.target.value })}
                className="h-11 w-20"
              />
            </div>
          ))}
        </div>

        <h3 className="mt-5 text-sm font-semibold">Texto de cada nível</h3>
        <div className="mt-2 space-y-2">
          {['1', '2', '3', '4', '5'].map((n) => (
            <div key={n}>
              <Label htmlFor={`txt-${n}`} className="text-xs">
                Nível {n}
              </Label>
              <Input
                id={`txt-${n}`}
                value={textos[n] ?? ''}
                onChange={(e) => setTextos({ ...textos, [n]: e.target.value })}
                className="mt-1 h-11"
              />
            </div>
          ))}
        </div>

        <h3 className="mt-5 text-sm font-semibold">Próximo passo por momento</h3>
        <div className="mt-2 space-y-2">
          {[
            ['estudando', 'Ainda estudando'],
            ['avaliando', 'Avaliando uma solução'],
            ['projeto_aprovado', 'Projeto aprovado'],
            ['tem_wms', 'Já tem WMS'],
          ].map(([k, rotulo]) => (
            <div key={k}>
              <Label htmlFor={`prox-${k}`} className="text-xs">
                {rotulo}
              </Label>
              <Input
                id={`prox-${k}`}
                value={proximos[k] ?? ''}
                onChange={(e) => setProximos({ ...proximos, [k]: e.target.value })}
                className="mt-1 h-11"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button className="h-11" onClick={salvarRegras} disabled={salvandoRegras}>
            {salvandoRegras ? 'Salvando…' : 'Salvar regras'}
          </Button>
          {okRegras && <span className="text-sm text-muted-foreground">{okRegras}</span>}
        </div>
      </section>
    </div>
  )
}
