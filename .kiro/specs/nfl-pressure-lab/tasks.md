# NFL Pressure Lab — Tasks

Base: `requirements.md` e `design.md` (mesma spec).
Estratégia: **construir primeiro um MVP funcional com UMA jogada real** (`2021090900 / 97`) ponta a ponta, e só então expandir. Cada tarefa é pequena, ordenada e verificável.

Convenção: `[ ]` pendente · cada tarefa lista **Entrega**, **Verificação** e os **Requisitos** que atende.

---

## Fase 0 — Fundação do projeto

- [x] **T0.1 — Criar estrutura de diretórios do app**
  - Entrega: `nfl-pressure-lab/` com `app/`, `app/data/plays/`, `src/`, `tests/`, `outputs/`, `docs/`.
  - Verificação: árvore de diretórios existe; nenhum arquivo em `data/` foi tocado.
  - Requisitos: RNF1, RNF6.
  - **Nota de implementação:** o pré-processamento ficou em `src/pressure_lab/preprocess.py` (pacote Python) em vez de `preprocess.py` na raiz. As pastas `app/css/` e `app/js/` ainda NÃO foram criadas — serão criadas na Fase 2 (interface).

- [x] **T0.2 — README inicial (esqueleto)**
  - Entrega: `nfl-pressure-lab/README.md` com nome, objetivo, dataset, arquitetura, funcionalidades previstas e status.
  - Verificação: arquivo existe e lista os passos previstos.
  - Requisitos: RNF7.
  - **Nota:** seção de instalação/execução detalhada permanece pendente (prevista para T4.5).

---

## Fase 1 — Pré-processamento do MVP (Python, 1 jogada)

- [x] **T1.1 — Ler contexto e resultado da jogada de `plays.csv`**
  - Entrega: função que, dado `gameId/playId`, retorna o dicionário `context` + `result` (Seção 6.2 do design), com `NA` → `null`.
  - Verificação: para `2021090900/97` retorna `passResult="I"`, `down=3`, `yardsToGo=2`, `pff_passCoverage="Cover-1"`.
  - Requisitos: RF8, P4.

- [x] **T1.2 — Identificar QB e pass rushers de `pffScoutingData.csv`**
  - Entrega: função que retorna o `nflId` do QB (`pff_role="Pass"`) e a lista de rushers (`pff_role="Pass Rush"`), + indicadores `pff_hit/hurry/sack` por jogador.
  - Verificação: para `2021090900/97` → QB=`25511`, rushers = {53504,42403,53441,41263,44955} (5 rushers), conforme analise-inicial §1/§2.
  - Requisitos: RF5, RF6.2, P3.

- [x] **T1.3 — Enriquecer jogadores com `players.csv`**
  - Entrega: join por `nflId` para nome, posição; monta o array `players` com `side/isQB/isPassRusher`.
  - Verificação: `25511` → "Tom Brady", posição "QB", `isQB=true`.
  - Requisitos: RF2.6, RF5.

- [x] **T1.4 — Extrair e reorganizar tracking por frame**
  - Entrega: leitura de `tracking/tracking_2021090900.csv` filtrando `playId=97`; monta `frames[]` com `positions`, `ball`, `event`, ordenado por `frameId`.
  - Verificação: `frameCount=43`; frame 1 tem posição do QB `~(37.77, 24.22)`; bola presente (`team=football`).
  - Requisitos: RF2, RF3, RNF3.

- [x] **T1.5 — Detectar eventos-chave (snap/lançamento/fim)**
  - Entrega: preenche `events` com frame + `source` (annotated/autoevent); `null` quando ausente.
  - Verificação: para `2021090900/97` → snap frame 6, throw frame 40 (ambos `annotated`); **`end = null`** — verificado que esta jogada NÃO possui evento de encerramento no tracking (só `ball_snap`@6, `autoevent_passforward`@38 e `pass_forward`@40). Ausência tratada explicitamente (P4).
  - Requisitos: RF7, P4.

- [x] **T1.6 — Pré-computar distância geométrica QB↔rusher por frame**
  - Entrega: para cada frame, `geometric_min_distance_yd` + `closest_rusher_nflId`, usando SOMENTE rushers; `null` se faltar posição.
  - Verificação (**teste de aceitação do pipeline**): no snap (frame 6) ≈ **5,78 jd**; no lançamento (frame 40) ≈ **1,79 jd** (analise-inicial §2).
  - Requisitos: RF6, P5, RNF8.

- [x] **T1.7 — Serializar JSON da jogada + atualizar índice**
  - Entrega: grava `app/data/plays/2021090900_97.json` no esquema da Seção 6.2 e cria/atualiza `app/data/plays_index.json`.
  - Verificação: JSON válido; recomputar `d` a partir de `positions` reproduz `geometric_min_distance_yd` (RNF8).
  - Requisitos: RNF2, RNF3, RNF4, RNF8.

- [x] **T1.8 — CLI do `preprocess.py`**
  - Entrega: aceita `--play GAMEID/PLAYID` (repetível), `--data-dir` e `--out-dir`; idempotente.
  - Verificação: rodar 2x gera o mesmo JSON (sha256 idêntico); não escreve em `data/`.
  - Requisitos: RNF2, RNF4, RNF6.
  - **Nota:** invocado como módulo — `PYTHONPATH=src python3 -m pressure_lab.preprocess --play 2021090900/97`.

> **✅ Fase 1 concluída** — pipeline Python ponta a ponta gerando JSON verificável para a jogada `2021090900/97`. Valores validados contra `docs/analise-inicial.md` (snap 5,78 jd; lançamento 1,79 jd). Suíte de testes automatizados (`tests/test_preprocess.py`): **18 testes, todos passando** (unittest, stdlib). A interface web (Fase 2) ainda NÃO foi iniciada.

---

## Fase 2 — Interface MVP (SVG + reprodução, 1 jogada)

- [x] **T2.1 — `index.html` + layout base + CSS**
  - Entrega: `app/index.html` (header, campo, painel lateral, timeline, rodapé) + `app/css/styles.css` (tema escuro, responsivo). HTML/CSS/JS separados.
  - Verificação: página servida por `python3 -m http.server` retorna 200; layout renderiza (verificado em navegador headless, desktop e mobile 390px → 1 coluna).
  - Requisitos: RNF1, RNF5.

- [x] **T2.2 — `field-renderer.js`: desenhar o campo SVG**
  - Entrega: `<svg viewBox="0 0 120 53.3">` com linhas de jarda (a cada 5), números e end zones sombreadas. Coordenadas do tracking mapeadas direto (Y invertido).
  - Verificação: campo proporcional; números 10–50–10 visíveis no screenshot.
  - Requisitos: RF2.1, RNF5.

- [x] **T2.3 — Carregar 1 jogada e renderizar o frame inicial**
  - Entrega: `app.js` faz `fetch` do JSON e chama `renderFrame`; 1 `<circle>` por jogador + bola, com classes por categoria (QB/ataque/defesa/rusher/bola) e legenda.
  - Verificação: 22 jogadores + bola renderizados e todos visíveis no frame 1 (checado via eval no navegador).
  - Requisitos: RF2, RF5.1, RNF3.

- [x] **T2.4 — Reprodução frame a frame + Play/Pause**
  - Entrega: `playback.js` com loop `requestAnimationFrame`, cadência 10 Hz, atualizando `cx/cy`. Usa somente frames reais (sem interpolação).
  - Verificação: Play por ~1 s a 1x avançou do frame 1 ao 12 (~10 fps); Pause funciona; para no último frame.
  - Requisitos: RF3.

- [x] **T2.5 — Timeline (slider), avançar/retroceder, contador de frame**
  - Entrega: slider sincronizado ao frame; botões +1/−1; contador "frame X/N"; atalhos de teclado (espaço/setas).
  - Verificação: slider posiciona no frame exato; +1 → 41, −1−1 → 39 (verificado).
  - Requisitos: RF4.

- [x] **T2.6 — Destaque de pass rushers + linha de aproximação**
  - Entrega: rushers em vermelho; `<line>` QB↔`closest_rusher_nflId` + rótulo de distância; usa somente rushers (P5).
  - Verificação: no frame 40 a distância exibida = **1,79 jd** e a linha aparece (visibility=visible) — bate com o JSON.
  - Requisitos: RF5, RF6.3, RF6.4, P5.

- [x] **T2.7 — Marcadores de evento na timeline**
  - Entrega: marcadores de snap/lançamento/fim; badge "(auto)" quando `source=autoevent`; nenhum marcador criado quando o evento é `null` (P4).
  - Verificação: snap@11.9% (frame 6) e lançamento@92.86% (frame 40) marcados; **fim ausente → sem marcador**; banner "encerramento não registrado no tracking" exibido.
  - Requisitos: RF7, P4.

- [x] **T2.8 — Painel de estatísticas em 3 camadas**
  - Entrega: `stats-panel.js` com blocos separados: (A) Aproximação geométrica (dist. atual, mín. da jogada, tempo desde o snap), (B) Pressão PFF (hit/hurry/sack + selo PFF), (C) Resultado + Contexto.
  - Verificação: três blocos com cabeçalhos e cores distintas; PFF mostra Hurries 4 / Hits 0 / Sacks 0; nenhum número combina as camadas; `null` → "não disponível".
  - Requisitos: RF8, P1, P3, P4.

**✅ Marco: MVP funcional CONCLUÍDO** — jogada `2021090900/97` reproduzível, com distância, eventos e estatísticas verificados em navegador (distâncias exibidas 5,78 jd no snap e 1,79 jd no lançamento batem com o JSON e com `docs/analise-inicial.md`).

---

## Fase 3 — Multi-jogada e extensibilidade

- [ ] **T3.1 — Processar um lote de jogadas variadas**
  - Entrega: rodar `preprocess.py` para ~5–10 jogadas cobrindo casos: passe completo, incompleto, sack (`passResult=S`), interceptação, e uma sem `pass_forward`.
  - Verificação: um JSON por jogada + `plays_index.json` atualizado; nenhum erro em jogadas sem lançamento.
  - Requisitos: RNF4, RF7.4.

- [x] **T3.2 — Seletor de jogadas na UI (a partir do índice)**
  - Entrega: dropdown populado por `plays_index.json`; trocar de jogada recarrega o replay sem reload de página (`app.js` → `loadPlay`).
  - Verificação: seletor populado a partir do índice (1 opção com a jogada atual). Adicionar jogada = rodar Python + índice, sem editar JS/HTML.
  - Requisitos: RF1, RNF4.
  - **Nota:** a troca dinâmica entre múltiplas jogadas só será plenamente exercitada quando houver mais de uma jogada no índice (T3.1).

- [x] **T3.3 — Estados vazios e de erro**
  - Entrega: mensagens para índice vazio, falha de fetch (JSON ausente), e jogada sem frames; banner de avisos para eventos ausentes.
  - Verificação: caminhos de erro implementados em `app.js` (`showEmpty`, try/catch); banner de ausência exibido para o `end` faltante.
  - Requisitos: RF1.5, RF5.3, P4.

---

## Fase 4 — Refinamentos analíticos e comunicação

- [x] **T4.1 — Controle de velocidade (0.5x/1x/2x)**
  - Entrega: seletor de velocidade (`app/index.html` + `playback.setSpeed`) afetando a cadência do loop.
  - Verificação: opções 0.5x/1x/2x presentes e ligadas ao controlador.
  - Requisitos: RF4.4.

- [x] **T4.2 — Gráfico da distância ao longo do tempo**
  - Entrega: `dist-chart.js` — gráfico SVG de `geometric_min_distance_yd` por frame, com linhas de snap/lançamento e cursor vertical sincronizado ao frame atual. Sem previsões nem classificações de pressão.
  - Verificação: `path.chart-line` renderizado; cursor acompanha a reprodução; rotulado "aproximação geométrica".
  - Requisitos: RF6, P5, RNF8.

- [x] **T4.3 — Seção "Sobre / Metodologia e Limitações"**
  - Entrega: `<details>` no rodapé com fonte, identificação de QB/rushers, fórmula de distância, as 3 camadas (P1) e não-causalidade (P2), e limitações.
  - Verificação: seção presente e acessível na página.
  - Requisitos: RF9, P1, P2.

- [x] **T4.4 — Tooltips e legenda**
  - Entrega: `<title>` em cada jogador (nome/posição/número/papel via hover) e legenda de cores completa.
  - Verificação: tooltips e legenda presentes no SVG/HTML.
  - Requisitos: RF2.5, RF2.6.
  - **Nota:** rótulo do número da camisa desenhado no círculo; hover mostra os detalhes completos.

- [ ] **T4.5 — Finalizar README (instalação, execução, adicionar jogadas)**
  - Entrega: passos completos: dependências, `python preprocess.py …`, `python -m http.server`, e "como adicionar uma jogada".
  - Verificação: seguir o README do zero produz o app rodando.
  - Requisitos: RNF7.

> **✅ Fase 2 concluída** — Pocket Replay 2D funcional (`app/index.html` + `app/css/styles.css` + `app/js/{field-renderer,playback,stats-panel,dist-chart,app}.js`). Reprodução, controles, aproximação geométrica, marcadores de evento, painel em 3 camadas, gráfico temporal e metodologia implementados e verificados em navegador headless (desktop + mobile). HTML/CSS/JS separados; consome apenas o JSON pré-processado. Pendentes: T3.1 (lote de jogadas), T4.5 (README de execução). O pipeline Python da Fase 1 não foi alterado (18 testes seguem passando).

---

## Ordem de execução recomendada
`T0.1 → T0.2 → T1.1 … T1.8 → T2.1 … T2.8 (MVP) → T3.x → T4.x`

## Rastreabilidade tarefas → requisitos (resumo)
- Reprodução/campo/controles: T2.1–T2.5 → RF2, RF3, RF4.
- Rushers/distância: T1.2, T1.6, T2.6 → RF5, RF6, P5.
- Eventos: T1.5, T2.7 → RF7.
- Estatísticas 3 camadas: T1.1, T1.2, T2.8 → RF8, P1.
- Extensibilidade/JSON: T1.7, T1.8, T3.1, T3.2 → RNF2–RNF4, RNF8.
- Metodologia/limitações: T4.3 → RF9, P1, P2.
- Preservar originais / local: T0.1, T1.8 → RNF1, RNF6.

Nenhuma tarefa depende de dado inexistente no dataset; toda métrica tem metodologia definida no `design.md`.
