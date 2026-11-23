# Ponto de recuperação — v0.0.188

**Commit:** `5e60730676eca66b14e67f2b4c60c86f46230d41`
**Publicado em produção:** `fc3c11d` · 23/11/2026 15:45 UTC
**Conferido:** 236 arquivos, 0 divergências por blob SHA entre o projeto Skip e este repositório.

## O que este ponto contém

- **Cenário das iscas**: vitrine pública do curso (`/backend/v1/ead/curso/{slug}`), aula isca assistível sem login, cadeado das aulas pagas leva à compra.
- **Rubrica do certificado** em coleção fechada — 401 sem sessão.
- **Porta de entrada única** por dor e por curso (`aula-dores-porta.pb.js`).
- **Limitador de requisições** com contagem única e retenção de 24 h.
- **Sem segredo versionado**: nenhuma senha, token ou conta de teste no repositório.
- `ead_config` recriado com `liberado = true`.

## Como recuperar

```
git clone https://github.com/Eduardo-Canal/wms-base-efici-ncia-j2nypml83.git
git checkout 5e60730676eca66b14e67f2b4c60c86f46230d41
```

Publique pela plataforma Skip. As migrations são numeradas na ordem de dependência — não pule nenhuma, e migration já aplicada não roda de novo (é por isso que os arquivos `0044` e `0048` estão vazios: continham senha de conta de teste).

## O que NÃO está validado neste ponto

1. **Fluxo compra → liberação de acesso** — depende de pagamento real.
2. **Player com vídeo real** — as 4 correções (retomada de posição, renovação de URL sem reiniciar o iframe, `player.js` após `ready`, `?amostra=1`) estão no código, mas não foram vistas tocando vídeo.
3. **Telas do painel a 390 px** — Diagnóstico, Minha área, Conclusão e Impressão compilam, mas não foram validadas visualmente.
4. **`/certificado/{código}/rubrica` com certificado válido** — o 401 sem sessão está provado; o caminho feliz não (não existe certificado no banco).

## Por que uma branch e não uma tag

A ferramenta de GitHub deste agente não expõe criação de tag nem de release. Esta branch fica apontada no commit exato, o que serve para recuperação igual a uma tag.

Para criar a tag de verdade, no seu terminal:

```
git fetch origin
git tag -a v0.0.188 5e60730676eca66b14e67f2b4c60c86f46230d41 -m "Ponto de recuperação: cenário das iscas"
git push origin v0.0.188
```
