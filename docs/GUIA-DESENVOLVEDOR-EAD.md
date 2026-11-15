# Guia do desenvolvedor — EAD (dentro do projeto 21885)

Documento para quem for mexer neste código depois. Explica **por que** cada peça
existe, não só o que ela faz. Atualizado em 15/11/2026.

---

## 1. Visão em uma tela

```
Visitante / Aluno / Admin
        │
        ▼
[ Front React — projeto Skip 21885 ]        /ead, /ead/entrar, /ead/minha-area,
        │                                   /ead/:cursoSlug, /ead/aula/:slug,
        │                                   /ead/comprar, /ead/obrigado, /ead/admin
        ▼
[ PocketBase 0.36.9 — Skip Cloud ]          /api/*          coleções (regras)
        │                                   /backend/v1/*    hooks (lógica)
        ▼
[ Externos ]  Bunny Stream (vídeo) · Mercado Pago (link estático) · Google Drive (PDF)
```

**Regra de ouro:** tela não é regra. Tudo que protege algo — matrícula, PDF,
admin, liberação — é checado no servidor. A tela esconde só para não oferecer
clique inútil.

---

## 2. O portão de liberação (`ead_config`)

O dono precisa montar e testar antes de qualquer visitante ver. Isso é **dado**,
não código.

| Peça     | Onde                                         | O que faz                                            |
| -------- | -------------------------------------------- | ---------------------------------------------------- |
| Coleção  | `migrations/0025_ead_config_e_mp_link.js`    | Registro único `chave="principal"`, campo `liberado` |
| Regra    | mesma migration                              | `liberado=false` → visitante recebe lista vazia      |
| Checagem | `hooks/admin-ead.pb.js` e os 3 hooks de aula | Bloco "PORTÃO" no topo de cada handler               |
| Tela     | `src/ead/telas/Admin.tsx`                    | Botão "Liberar / Fechar para o público"              |

**Para desligar o EAD inteiro:** `/ead/admin` → "Fechar para o público". Nenhum
build, nenhum deploy.

**Quem passa fechado:** `admin` e `suporte` — é o modo de teste do dono.

**Na dúvida, fechado:** se a leitura da config falhar, a checagem devolve `false`.
Falha de infraestrutura não pode virar vazamento.

### ⚠ Por que a checagem é copiada em cada hook

`require()` de arquivo local **não funciona** no JSVM deste projeto. Todas as
libs (`comum`, `acesso`) estão duplicadas dentro de cada handler, exatamente por
isso. Então o portão também é inline.

**Consequência prática:** endpoint novo do EAD **precisa** do bloco PORTÃO copiado,
senão nasce aberto. O bloco está sempre no topo do handler, entre `(e) => {` e
`const comum = {`.

---

## 3. Coleções

| Coleção                  | Papel                                 | Leitura                            |
| ------------------------ | ------------------------------------- | ---------------------------------- |
| `users`                  | conta + `papel` (aluno/admin/suporte) | própria, admin, suporte            |
| `cursos`                 | o conteúdo                            | publicado                          |
| `modulos`                | agrupamento                           | idem                               |
| `aulas`                  | a aula (slug, numero, ordem, duração) | **publicada é pública** (ver 0018) |
| `aulas_midia`            | `video_id` do Bunny                   | fechada                            |
| `produtos`               | preço, `mp_link`, cursos              | `ativo && preco > 0`               |
| `pedidos` / `pagamentos` | compra                                | fechada                            |
| `matriculas`             | quem tem acesso                       | a própria                          |
| `progresso_aulas`        | aula assistida                        | a própria                          |
| `log_acessos`            | auditoria (IP com hash)               | fechada                            |
| `ead_config`             | o portão + textos                     | liberado (ou equipe)               |

### Duas armadilhas de campo em `aulas`

1. **`material` (arquivo) e `material_url` (link do Drive) ficam expostos na
   listagem pública.** A `0018` abriu a listagem de `aulas` para o visitante (o
   índice do curso precisa mostrar título e cadeado) e, por consequência, todo
   campo da linha vai junto — regra de linha não tem granularidade de campo.
   Hoje os dois estão vazios, então não vazou nada; **no dia em que receberem
   valor, é preciso um hook `onRecordEnrich` escondendo os dois de quem não tem
   matrícula.**
2. **`matriculas` tem `criado_em`, não `created`.** Ordenar por `-created` faz a
   consulta **lançar**, o `catch` engole e quem tem matrícula é tratado como sem
   acesso. Bug real, já corrigido nos hooks — use `sort ''` ou `criado_em`.

---

## 4. Armadilhas do PocketBase 0.36.9 (todas verificadas aqui)

1. Cada handler do JSVM roda em **escopo isolado**: nada fora do callback é
   visível. Libs vão inline.
2. `null` não existe em text/number/date. Ausência grava `''` ou `0` → **`0` é o
   marcador de "não definido"** (preço, duração) e a barreira é validação.
3. Coleção base **não** cria `created`/`updated`: precisa `autodate` explícito.
4. `new Collection({...})` recebe **objetos simples**; `col.fields.add(...)` em
   coleção existente recebe **`new TextField({...})`**. Trocar isso faz os campos
   serem descartados **em silêncio**.
5. Regras e campos na **mesma** `new Collection` — a regra é validada contra os
   campos no momento do save.
6. `findCollectionByNameOrId` / `findRecordById` / `findFirstRecordByFilter`
   **lançam** em vez de devolver null: sempre `try/catch`.
7. `$security.hs256(DADOS, CHAVE)` — dados primeiro. Invertido, nunca valida.
8. Regra `null` devolve **200 com lista vazia**, não 403: não é barreira.
9. `protected: true` num campo de arquivo **não** protege quando a coleção tem
   leitura pública. Arquivo privado de verdade só em coleção fechada.

---

## 5. Fluxo de venda — fase 1 (link manual)

```
1. Aluno cria conta em /ead/entrar
2. Abre o curso em /ead/{slug} e clica "Comprar"
3. Vai para o LINK do Mercado Pago (produtos.mp_link) e paga
4. Dono confere o pagamento no painel do MP
5. Dono abre /ead/admin → "Liberar acesso" → e-mail + slug do curso
6. Aluno entra em /ead e assiste
```

**Limite honesto:** link de pagamento é estático — não devolve quem pagou. Por
isso o passo 5 é manual. Liberação automática exige Checkout Pro + webhook
(`hooks/checkout.pb.js` e `hooks/webhook-mercadopago.pb.js` já existem; falta
credencial e teste com pagamento real).

---

## 6. Segredos e variáveis

Nunca no código, nunca no chat. Painel do Skip Cloud → Segredos.

| Nome                               | Para quê             | Sem ele                     |
| ---------------------------------- | -------------------- | --------------------------- |
| `BUNNY_STREAM_LIBRARY_ID`          | URL do vídeo         | playback 503                |
| `BUNNY_STREAM_TOKEN_KEY`           | assinar a URL        | playback 503                |
| `MP_ACCESS_TOKEN`                  | preferência (fase 2) | checkout 503                |
| `MP_WEBHOOK_SECRET`                | assinatura do MP     | webhook 503                 |
| `EAD_IP_SALT`                      | hash do IP no log    | usa sal fixo (menos seguro) |
| `CURSO_FUNDAMENTOS_PRECO_CENTAVOS` | preço do curso 1     | usa o do banco              |

**503 e não 500:** segredo ausente é configuração faltando, não bug — e a
mensagem diz qual.

---

## 7. Como adicionar um endpoint

1. Crie `pocketbase/hooks/<nome>.pb.js`.
2. **Copie o bloco PORTÃO** no topo, se for rota do EAD.
3. Libs comuns (`comum`, `acesso`) vão **inline** dentro do handler.
4. Autenticação: `$apis.requireAuth()` como último argumento, ou checagem de
   `papel` feita à mão (como em `admin-ead.pb.js`).
5. Segredo: sempre via `$secrets.get(nome, '')` com fallback `$os.getenv`.
6. Chame em `src/ead/api.ts`; a tela **nunca** monta URL na mão.
7. Ao final: `skip_project_apply_changes` (isso builda e testa).

## 8. Como adicionar campo/coleção

1. Migration nova numerada (`0026_...`). **Nunca edite migration já aplicada** —
   ela não roda de novo e o banco fica diferente do código.
2. Campo em coleção que o cliente lê passa a ser **exposto** junto com a linha.
   Se for sensível, coleção separada.
3. Ao aplicar: é build de backend, a API cai de 0,3 a 15 s. Escolher janela.

---

## 9. O que ainda não existe

- Liberação automática de acesso (existe código, falta credencial)
- E-mail de definir senha e de confirmação de compra
- Relatórios e métricas de venda
- Hook que esconde `material` / `material_url` de quem não tem matrícula
  (hoje os dois campos estão vazios — ver §3)
