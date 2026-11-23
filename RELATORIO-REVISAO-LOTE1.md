# Revisão técnica externa — Lote 1 (backend do EAD)

**Projeto:** Skip 21885 — WMS Base Eficiência
**Versão publicada:** v0.0.122, ref `0130032`
**Data:** 18/11/2026

## Nota de entrada — sobre o commit 2187653

O commit `2187653` **não existe** em nenhum dos seus repositórios do GitHub. Verifiquei:

- `Plataforma_EAD` tem **1 commit**, o `6eba688` ("Initial commit", 26/10/2026), com apenas um README de 32 bytes.
- A busca global por `2187653` retorna commits de outros projetos públicos (wallaby, firefox-l10n, etc.).

O projeto no Skip estava na **v0.0.119** (ref `b7b2ab3`) e produção servindo a **v0.0.116**. Ou seja: houve trabalho entre 17/11 e 18/11 que eu não fiz e não vi. Auditei o backend antes de mexer: os 9 hooks que eu ia alterar **não tinham sido tocados** — as versões 117–119 não mudaram `progresso-aula`, `certificado`, `webhook-mercadopago`, `vouchers` nem `portao-listagem`. Segui sobre a versão que estava lá.

Se a revisão foi feita sobre um código diferente deste, me diga qual — refaço a conferência item por item.

---

## PRIORIDADE 1

### 1. Conta de teste com papel admin — **PARCIAL**

**O que fiz:** levantei todas as contas com papel `admin` ou `suporte`.

| Papel | Nome                                             | E-mail                          | Criada em        |
| ----- | ------------------------------------------------ | ------------------------------- | ---------------- |
| admin | (conta do Skip/Gateway)                          | **sem e-mail** (`Banco_ead`)    | 2026-11-15 03:40 |
| admin | Admin Teste                                      | admin.teste@exemplo.com         | 2026-11-15 23:18 |
| admin | — (conta do dono, promovida pela 0026/0027/0028) | eduardo.canal@zionlogtec.com.br | anterior a 15/11 |

Contas `aluno`: 3 (Aluno Voucher, Aluno Dois, Cadastro Teste — todas de teste, `verified=false`).

**Por que não apaguei:** `users` tem `deleteRule: null` — **ninguém apaga conta pela API**, só superusuário. A alternativa seria uma migration de limpeza, e a **regra 1 deste lote proíbe exatamente isso**. Não ia quebrar a sua regra para cumprir outro item.

**Como resolver em 2 minutos, sem migration:** no painel do Skip Cloud → coleção `users` → apague o registro `0j0d7bb4tpo2imw` (`admin.teste@exemplo.com`). Se preferir que eu faça, autorize **uma** migration de exclusão nominal e eu executo.

**Risco se ficar:** uma conta admin com senha que circulou em conversa.

### 2. Conclusão de aula forjável — **FEITO**

**Arquivos:** `pocketbase/hooks/progresso-aula.pb.js`, `pocketbase/hooks/cron-ead.pb.js` (não aplicável aqui), `src/ead/telas/Player.tsx` (só exibe aviso novo)

**O que mudou:**

1. **A duração enviada pelo cliente é ignorada por completo.** Fonte única: `duracao_seg` do cadastro. Sem duração, a aula grava posição e **nunca conclui**, e a resposta traz `duracao_ausente: true`.
2. **Crédito por intervalo** = menor entre (a) avanço da posição, (b) tempo de relógio do servidor × 2, (c) **60 s**. Antes cabiam 3600 s por report.
3. Erro interno não devolve `err.message` ao cliente.

**Como testei** (`work/revisao-lote1/teste.py`, contra produção):

| Teste                                            | Resultado                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| POST com `duracao: 1` numa aula de 180 s         | alvo continuou **162 s** (90% de 180) — duração do cliente ignorada ✓ |
| Mesmo POST em aula de 180 s sem histórico        | `assistidos=0`, `concluida=false` ✓                                   |
| POST em aula com `duracao_seg=0` pedindo 99999 s | `concluida=false`, `duracao_ausente=true` ✓                           |

**Aceite:** aula sem duração nunca conclui ✓ · posição no fim não conclui ✓ · assistir normalmente conclui (testado antes em 9 reports de 20 s: concluiu em 166/185 s).

**Pendente deste item (declarado):** o preenchimento automático de `duracao_seg` pela API do Bunny **não foi implementado** — falta a API key da biblioteca nos segredos. Existe hoje o preenchimento manual no painel (campo "duração"). São necessários **2 valores**: `BUNNY_STREAM_API_KEY` (API key da biblioteca) e a Library ID já usada. Com eles eu implemento a ação "sincronizar durações" e a atualização ao vincular vídeo.

### 3. Certificado sem matrícula — **FEITO**

**Arquivo:** `pocketbase/hooks/certificado.pb.js`

- Emissão agora exige **matrícula ativa** no curso (403 `sem_matricula`). Equipe passa, para testar.
- **Nome obrigatório** (409 `nome_obrigatorio`): o e-mail nunca mais entra em `nome_aluno`.
- **Validação pública higieniza na saída**: se `nome_aluno` contiver `@` (certificados antigos), devolve `Aluno(a)`.

**Teste:** conta sem matrícula → `403 ead_fechado` (o portão barra antes); código inexistente → 404 genérico.

---

## PRIORIDADE 2

### 4. Reembolso e chargeback não revogam acesso — **FEITO (código), teste parcial**

**Arquivos:** `webhook-mercadopago.pb.js`, `cron-ead.pb.js`

- Removida a saída antecipada `duplicado`. Agora o webhook **consulta o gateway** e só encerra como duplicado quando o status retornado é **igual ao gravado**.
- `refunded`/`charged_back` → pedido `reembolsado` + matrículas `reembolsada` (acesso cai).
- Cron: a consulta de pendentes segue a mesma regra.

**Teste:** não consegui simular reembolso real — exige pagamento aprovado de verdade no MP. **Declaro como não testado ponta a ponta.** O aceite (aprovado → acesso → reembolso → acesso removido → repetição não duplica) precisa de um pagamento real de teste.

### 5. Liberação pelo e-mail sem conferir valor — **FEITO**

**Arquivos:** `webhook-mercadopago.pb.js`, `cron-ead.pb.js`, `migrations/0042_pagamentos_conferencia.js`

O plano B agora exige: **valor pago igual a `pedido.valor_centavos`** E **pagamento posterior ao pedido** (tolerância de 5 min). Fora disso, não libera e grava o motivo em `pagamentos.observacao` (`valor_ou_data_divergente` / `sem_pedido_para_o_email`) para conferência no painel. Mesma regra replicada no cron, como pedido.

### 6. Compra em conta com e-mail não verificado — **FEITO**

Se a conta existe com `verified=false`: senha trocada por aleatória (derruba sessões de terceiro), `verified` mantido falso, e o fluxo de definir senha é disparado pelo endpoint nativo `/api/collections/users/request-password-reset` **antes** de criar a matrícula. Replicado no cron.

### 7. Assinatura de Orders em minúsculas — **NÃO FEITO**

Não confirmei na documentação do MP se o `data.id` deve ir em minúsculas para Orders, e **não testei no simulador** — não tenho acesso ao painel do MP. Não vou afirmar o que não verifiquei. Fica como pendência para a janela de teste do pagamento.

---

## PRIORIDADE 3 — Vouchers

### 8. Corrida no limite de usos — **FEITO**

**Arquivo:** `vouchers.pb.js`

Checagem de limite, criação de matrícula, registro do resgate e incremento de `usos` agora rodam dentro de **`$app.runInTransaction`**, com **releitura do voucher dentro da transação**. O incremento usa o valor lido na transação (`usosTx + 1`), não o valor da checagem anterior. O `catch` vazio do save do contador foi eliminado.

### 9. Voucher com `email_destino` aceita conta não verificada — **FEITO**

Exige `verified = true` quando há destinatário. Sem verificação: dispara o e-mail de verificação pelo endpoint nativo e responde `403` com `codigo: 'verificar_email'`.

### 10. `Math.random` em códigos — **FEITO**

- Voucher: `$security.randomStringWithAlphabet(10, ...)` (era 8).
- Certificado: `$security.randomStringWithAlphabet(8, ...)`, formato mantido `WMS-XXXX-XXXX`.

### 11. Rate limit — **NÃO FEITO**

O rate limit do PocketBase é configuração do servidor, não código, e **não tenho ferramenta que exponha esses valores** nesta sessão. Não vou dizer que configurei o que não configurei.

**Valores que recomendo** (para você aplicar em Skip Cloud → Configurações, ou autorizar que eu procure o endpoint):

| Rota                                             | Limite sugerido  |
| ------------------------------------------------ | ---------------- |
| `POST /backend/v1/voucher/resgatar`              | 10 / 60 s por IP |
| `GET /backend/v1/certificado/{codigo}`           | 30 / 60 s por IP |
| `POST /api/collections/users/auth-with-password` | 10 / 60 s por IP |
| `POST /api/collections/users/records`            | 5 / 60 s por IP  |

---

## PRIORIDADE 4 — Portão e exposição

### 12. Portão — **FEITO** (exceto rate limit do item 11)

**Arquivos:** `portao-listagem.pb.js` (reescrito), `aula-material-oculto.pb.js` (novo), `checkout.pb.js`, `vouchers.pb.js`, `progresso-aula.pb.js`, `certificado.pb.js`

Regra aplicada: com a área fechada, **equipe e matrícula ativa passam**; visitante e conta sem matrícula veem 403.

- Portão acrescentado em **checkout, vouchers, progresso e certificado** (emissão).
- **`aulas` e `partes`** agora fechadas também na **listagem e na visualização por id**.
- **`material`/`material_url` escondidos** de quem não tem matrícula, via `onRecordEnrich` em `aulas` (era o item 9 do GUIA).

**Testes (produção):**

| Teste                               | Resultado             |
| ----------------------------------- | --------------------- |
| visitante lista `aulas`             | **403** ✓             |
| visitante lista `partes`            | **403** ✓             |
| aluno com matrícula lista `aulas`   | **200** ✓             |
| conta sem matrícula lista `aulas`   | **403** ✓             |
| `material_url` na listagem do aluno | **0 links vazados** ✓ |

### 13. `concluir-equipe` — **FEITO**

Restrito a **admin/superusuário** (`403 somente_admin` para suporte e aluno) e toda marcação grava em `log_acessos` com **quem marcou, para quem e quando**.

### 14. Rubrica pública — **NÃO FEITO**

Mover a imagem para coleção fechada e servir "só composta no certificado" exige mudar o modelo de arquivo **e** a renderização do certificado (hoje a tela baixa a imagem e monta o documento no navegador). É mudança de arquitetura com efeito na tela, e este lote é de backend. **Recomendo tratar no lote 2 (front), junto com o mockup.** Risco atual: a rubrica sozinha é uma imagem de assinatura sem dado de aluno — baixá-la não falsifica um certificado, porque a validação pública é que confere o código.

### 15. Escape do `name` no e-mail — **FEITO**

`acesso-email.pb.js` escapa `& < > " '` antes de montar o HTML.

### 16. `log_acessos` — **FEITO (parcial)**

- **Agregação:** `playback-publico` grava no máximo **1 linha por aula/IP/hora** (era 1 por requisição).
- **`EAD_IP_SALT` obrigatório:** o sal fixo `'ead-sem-sal'` foi removido de `playback` e `playback-publico`. Sem o segredo, **não grava hash de IP** (em vez de gravar um hash falso-seguro).
- Rate limit propriamente dito: depende do item 11.

### 17. CDN token authentication do Bunny — **NÃO VERIFICADO**

Não tenho acesso ao painel do Bunny. **Preciso que você confira:** Bunny → Stream → sua biblioteca → _Security_ → **"CDN Token Authentication"** ligado. Se estiver desligado, o HLS abre com o GUID e a URL assinada do embed é contornável.

---

## PRIORIDADE 5

### 18. Migration 0028 derruba banco novo — **FEITO**

`throw new Error(...)` → `console.log(...) + return`. Edição intencional em migration aplicada, como você autorizou.

### 19. Dev e produção usam o mesmo banco? — **SIM**

Evidência medida: `skip_cloud_get_backend_url` devolve **um único** host (`wms-base-eficiencia-c56b6.shrd01.internal.goskip.dev`) para o projeto, e é ele que atende as duas refs (`lastDevBuildRef` e `lastPublishedRef`). Não há banco separado de desenvolvimento. Consequência prática: **teste em preview grava dado real** — foi assim que a conta `admin.teste` e os progressos de teste entraram no banco de produção.

---

## Resumo de status

| #   | Item                      | Status                                             |
| --- | ------------------------- | -------------------------------------------------- |
| 1   | Conta admin de teste      | **parcial** — listada, não apagada (regra do lote) |
| 2   | Conclusão forjável        | **feito** (falta duração via Bunny API)            |
| 3   | Certificado sem matrícula | **feito**                                          |
| 4   | Refund/chargeback         | **feito** (sem teste real)                         |
| 5   | Plano B por valor/data    | **feito**                                          |
| 6   | E-mail não verificado     | **feito**                                          |
| 7   | Assinatura Orders         | **não feito**                                      |
| 8   | Transação no voucher      | **feito**                                          |
| 9   | Voucher + verified        | **feito**                                          |
| 10  | CSPRNG                    | **feito**                                          |
| 11  | Rate limit                | **não feito**                                      |
| 12  | Portão + material         | **feito**                                          |
| 13  | concluir-equipe           | **feito**                                          |
| 14  | Rubrica fechada           | **não feito** (lote 2)                             |
| 15  | Escape do nome            | **feito**                                          |
| 16  | log_acessos               | **parcial** (sal + agregação ok)                   |
| 17  | CDN token Bunny           | **não verificado**                                 |
| 18  | Migration 0028            | **feito**                                          |
| 19  | Mesmo banco dev/prod      | **sim**                                            |

**10 feitos · 2 parciais · 4 não feitos · 1 não verificado**

## O que ainda bloqueia a operação (não é deste lote)

1. **Chaves do Bunny ausentes** — nenhum vídeo toca. Preciso de `BUNNY_STREAM_LIBRARY_ID` e `BUNNY_STREAM_TOKEN_KEY` (e `BUNNY_STREAM_API_KEY` para as durações).
2. **`EAD_IP_SALT` não configurado** — agora que o sal fixo saiu, sem ele o log não registra hash de IP.
3. **Portão fechado** — nada é vendido enquanto `liberado = false`.
