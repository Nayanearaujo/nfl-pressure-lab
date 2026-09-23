# NFL Pressure Lab — Tasks

Base: `requirements.md` e `design.md` (mesma spec).
Estratégia: **construir primeiro um MVP funcional com UMA jogada real** (`2021090900 / 97`) ponta a ponta, e só então expandir. Cada tarefa é pequena, ordenada e verificável.

Convenção: `[ ]` pendente · cada tarefa lista **Entrega**, **Verificação** e os **Requisitos** que atende.

---

## Fase 0 — Fundação do projeto

- [ ] **T0.1 — Criar estrutura de diretórios do app**
  - Entrega: `nfl-pressure-lab/` com `app/`, `app/css/`, `app/js/`, `app/data/plays/` e `preprocess.py` vazio (stub).
  - Verificação: árvore de diretórios existe; nenhum arquivo em `data/` foi tocado.
  - Requisitos: RNF1, RNF6.

- [ ] **T0.2 — README inicial (esqueleto)**
  - Entrega: `nfl-pressure-lab/README.md` com seções Instalação, Pré-processamento, Execução (a preencher).
  - Verificação: arquivo existe e lista os passos previstos.
  - Requisitos: RNF7.

---

## Fase 1 — Pré-processamento do MVP (Python, 1 jogada)

- [ ] **T1.1 — Ler contexto e resultado da jogada de `plays.csv`**
  - Entrega: função que, dado `gameId/playId`, retorna o dicionário `context` + `result` (Seção 6.2 do design), com `NA` → `null`.
  - Verificação: para `2021090900/97` retorna `passResult="I"`, `down=3`, `yardsToGo=2`, `pff_passCoverage="Cover-1"`.
  - Requisitos: RF8, P4.

- [ ] **T1.2 — Identificar QB e pass rushers de `pffScoutingData.csv`**
  - Entrega: função que retorna o `nflId` do QB (`pff_role="Pass"`) e a lista de rushers (`pff_role="Pass Rush"`), + indicadores `pff_hit/hurry/sack` por jogador.
  - Verificação: para `2021090900/97` → QB=`25511`, rushers = {53504,42403,53441,41263,44955} (5 rushers), conforme analise-inicial §1/§2.
  - Requisitos: RF5, RF6.2, P3.

- [ ] **T1.3 — Enriquecer jogadores com `players.csv`**
  - Entrega: join por `nflId` para nome, posição; monta o array `players` com `side/isQB/isPassRusher`.
  - Verificação: `25511` → "Tom Brady", posição "QB", `isQB=true`.
  - Requisitos: RF2.6, RF5.

- [ ] **T1.4 — Extrair e reorganizar tracking por frame**
  - Entrega: leitura de `tracking/tracking_2021090900.csv` filtrando `playId=97`; monta `frames[]` com `positions`, `ball`, `event`, ordenado por `frameId`.
  - Verificação: `frameCount=43`; frame 1 tem posição do QB `~(37.77, 24.22)`; bola presente (`team=football`).
  - Requisitos: RF2, RF3, RNF3.

- [ ] **T1.5 — Detectar eventos-chave (snap/lançamento/fim)**
  - Entrega: preenche `events` com frame + `source` (annotated/autoevent); `null` quando ausente.
  - Verificação: para `2021090900/97` → snap frame 6, throw frame 40 (annotated); fim = incompleto.
  - Requisitos: RF7, P4.

- [ ] **T1.6 — Pré-computar distância geométrica QB↔rusher por frame**
  - Entrega: para cada frame, `geometric_min_distance_yd` + `closest_rusher_nflId`, usando SOMENTE rushers; `null` se faltar posição.
  - Verificação (**teste de aceitação do pipeline**): no snap (frame 6) ≈ **5,78 jd**; no lançamento (frame 40) ≈ **1,79 jd** (analise-inicial §2).
  - Requisitos: RF6, P5, RNF8.

- [ ] **T1.7 — Serializar JSON da jogada + atualizar índice**
  - Entrega: grava `app/data/plays/2021090900_97.json` no esquema da Seção 6.2 e cria/atualiza `app/data/plays_index.json`.
  - Verificação: JSON válido; recomputar `d` a partir de `positions` reproduz `geometric_min_distance_yd` (RNF8).
  - Requisitos: RNF2, RNF3, RNF4, RNF8.

- [ ] **T1.8 — CLI do `preprocess.py`**
  - Entrega: aceitar `--game`/`--play` (ou arquivo de lista) e o caminho da pasta `data/`; idempotente.
  - Verificação: rodar 2x gera o mesmo JSON; não escreve em `data/`.
  - Requisitos: RNF2, RNF4, RNF6.

---

## Fase 2 — Interface MVP (SVG + reprodução, 1 jogada)

- [ ] **T2.1 — `index.html` + layout base + CSS**
  - Entrega: estrutura da página (header, área do campo, painel lateral, timeline, rodapé) e `styles.css`.
  - Verificação: página abre servida por `python -m http.server`; layout visível.
  - Requisitos: RNF1, RNF5.

- [ ] **T2.2 — `field-renderer.js`: desenhar o campo SVG**
  - Entrega: `<svg viewBox="0 0 120 53.3">` com linhas de jarda, números e end zones sombreadas.
  - Verificação: campo com proporção correta (120×53.3); 10 linhas de jarda visíveis.
  - Requisitos: RF2.1, RNF5.

- [ ] **T2.3 — Carregar 1 jogada e renderizar o frame inicial**
  - Entrega: `app.js` faz `fetch` do JSON da jogada e chama `renderFrame(frames[0])`; cria 1 `<circle>` por jogador + bola com classes por categoria.
  - Verificação: todos os jogadores e a bola aparecem nas posições do frame 1; legenda visível.
  - Requisitos: RF2, RF5.1, RNF3.

- [ ] **T2.4 — Reprodução frame a frame + Play/Pause**
  - Entrega: `playback.js` com loop `requestAnimationFrame` a 10 Hz (1x) atualizando `cx/cy`.
  - Verificação: ao dar Play, jogadores se movem e a animação para no último frame.
  - Requisitos: RF3.

- [ ] **T2.5 — Timeline (slider), avançar/retroceder, contador de frame**
  - Entrega: slider sincronizado a `currentFrame`; botões +1/−1 frame; exibição "frame X/N".
  - Verificação: arrastar o slider posiciona os jogadores no frame exato; contador correto.
  - Requisitos: RF4.

- [ ] **T2.6 — Destaque de pass rushers + linha de aproximação**
  - Entrega: rushers com estilo distinto; `<line>` QB↔`closest_rusher_nflId` do frame + rótulo de distância.
  - Verificação: no frame 40 a distância exibida ≈ 1,79 jd e a linha liga QB ao rusher correto.
  - Requisitos: RF5, RF6.3, RF6.4, P5.

- [ ] **T2.7 — Marcadores de evento na timeline**
  - Entrega: marcadores de snap/lançamento/fim; badge "automático" quando `source=autoevent`; texto de ausência quando `null`.
  - Verificação: snap no frame 6 e lançamento no 40 marcados; jogada sem lançamento mostra "Lançamento não registrado".
  - Requisitos: RF7, P4.

- [ ] **T2.8 — Painel de estatísticas em 3 camadas**
  - Entrega: `stats-panel.js` com blocos separados: Contexto · Aproximação geométrica (dist. atual + mín. da jogada) · Pressão PFF (hit/hurry/sack + selo PFF) · Resultado.
  - Verificação: os três blocos aparecem separados; campos `null` mostram "não disponível"; nenhum número combina as camadas.
  - Requisitos: RF8, P1, P3, P4.

**✅ Marco: MVP funcional** — 1 jogada real reproduzível, com distância, eventos e estatísticas verificáveis.

---

## Fase 3 — Multi-jogada e extensibilidade

- [ ] **T3.1 — Processar um lote de jogadas variadas**
  - Entrega: rodar `preprocess.py` para ~5–10 jogadas cobrindo casos: passe completo, incompleto, sack (`passResult=S`), interceptação, e uma sem `pass_forward`.
  - Verificação: um JSON por jogada + `plays_index.json` atualizado; nenhum erro em jogadas sem lançamento.
  - Requisitos: RNF4, RF7.4.

- [ ] **T3.2 — Seletor de jogadas na UI (a partir do índice)**
  - Entrega: dropdown populado por `plays_index.json`; trocar de jogada recarrega o replay sem reload de página.
  - Verificação: adicionar jogada nova (rodar Python + índice) faz ela aparecer no seletor **sem editar JS/HTML**.
  - Requisitos: RF1, RNF4.

- [ ] **T3.3 — Estados vazios e de erro**
  - Entrega: mensagens para índice vazio, JSON ausente/corrompido, jogada sem rushers.
  - Verificação: cada caso mostra mensagem clara, sem quebrar a UI.
  - Requisitos: RF1.5, RF5.3, P4.

---

## Fase 4 — Refinamentos analíticos e comunicação

- [ ] **T4.1 — Controle de velocidade (0.5x/1x/2x)**
  - Entrega: seletor de velocidade afetando o intervalo do loop.
  - Verificação: reprodução acelera/desacelera conforme selecionado.
  - Requisitos: RF4.4.

- [ ] **T4.2 — Gráfico da distância ao longo do tempo (opcional)**
  - Entrega: mini-gráfico da `geometric_min_distance_yd` por frame, com marcadores de snap/lançamento.
  - Verificação: curva bate com os valores do JSON; rótulo "aproximação geométrica".
  - Requisitos: RF6, P5, RNF8.

- [ ] **T4.3 — Seção "Sobre / Metodologia e Limitações"**
  - Entrega: texto com fonte dos dados, identificação de QB/rushers, fórmula de distância, e limitações (analise-inicial §6); explica as 3 camadas (P1) e o não-uso de causalidade (P2).
  - Verificação: seção acessível pela UI; conteúdo bate com a spec.
  - Requisitos: RF9, P1, P2.

- [ ] **T4.4 — Tooltips e legenda final**
  - Entrega: hover com nome/posição/número; legenda de cores completa.
  - Verificação: hover mostra os dados corretos por `data-nflid`.
  - Requisitos: RF2.5, RF2.6.

- [ ] **T4.5 — Finalizar README (instalação, execução, adicionar jogadas)**
  - Entrega: passos completos: dependências, `python preprocess.py …`, `python -m http.server`, e "como adicionar uma jogada".
  - Verificação: seguir o README do zero produz o app rodando.
  - Requisitos: RNF7.

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
