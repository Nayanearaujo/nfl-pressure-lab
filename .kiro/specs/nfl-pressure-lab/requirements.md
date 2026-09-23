# NFL Pressure Lab — Requirements

**Projeto:** Hackathon NFL Big Data Bowl RJ — AWS, NFL & Estácio
**Dataset:** NFL Big Data Bowl 2023 (temporada 2021, semanas 1–8)
**Documentos base:** `data-reference.md`, `analise-inicial.md`

## Visão geral

Aplicação web interativa (**NFL Pressure Lab**) para analisar a pressão defensiva sobre o quarterback (QB) usando dados reais de tracking da NFL. A funcionalidade central é o **Pocket Replay 2D**: um campo visto de cima que reproduz a movimentação dos jogadores frame a frame, destacando os pass rushers e a distância entre o QB e o pass rusher mais próximo.

Pergunta central: *"Como a movimentação dos defensores influencia o espaço e o tempo disponíveis para o quarterback executar uma jogada?"*

### Princípios inegociáveis (herdados de `analise-inicial.md`)

Estes princípios são **critérios de aceitação transversais** e aplicam-se a TODAS as histórias abaixo:

- **P1 — Três camadas distintas.** A interface deve diferenciar visual e textualmente: (a) **aproximação geométrica** (distância calculada de `x,y`), (b) **pressão registrada pela PFF** (`pff_hit`/`pff_hurry`/`pff_sack`), (c) **resultado da jogada** (`passResult`, `playResult`). Nunca fundir as três em um único rótulo.
- **P2 — Sem causalidade.** Não afirmar que aproximação "causou" o resultado. Usar linguagem descritiva ("nesta jogada, o rusher chegou a X jardas; o passe foi incompleto"), não causal.
- **P3 — Sem invenção.** Nenhuma estatística ou métrica sem metodologia documentada no `design.md`. Métricas derivadas são rotuladas como "métrica calculada pelo app", distintas das oficiais NFL/PFF.
- **P4 — Ausência explícita.** Quando um dado não existir (ex.: sem evento `pass_forward`), a interface exibe rótulo claro de ausência ("Lançamento não registrado"), nunca um valor inventado ou 0 silencioso.
- **P5 — Aproximação ≠ pressão.** A distância mínima QB↔rusher NUNCA é rotulada automaticamente como "pressão". É "aproximação geométrica".

---

## Requisitos Funcionais

### RF1 — Seleção de jogada

**História:** Como analista, quero selecionar uma jogada disponível a partir de uma lista, para reproduzi-la e analisá-la.

**Critérios de aceitação:**
1. QUANDO a aplicação carrega, ENTÃO exibe uma lista/seletor das jogadas processadas disponíveis.
2. CADA item da lista DEVE mostrar identificação legível: times (posse × defesa), quarter, down & yardsToGo, e a descrição (`playDescription`).
3. QUANDO o usuário seleciona uma jogada, ENTÃO o Pocket Replay carrega os dados daquela jogada sem recarregar a página.
4. A lista DEVE ser alimentada por um índice JSON (`plays_index.json`), permitindo adicionar novas jogadas sem alterar o código da interface (ver RNF4).
5. SE nenhuma jogada estiver disponível, ENTÃO a interface exibe uma mensagem clara de estado vazio.

### RF2 — Renderização do campo e dos jogadores

**História:** Como analista, quero ver o campo de futebol americano de cima com QB, ataque, defesa e bola posicionados.

**Critérios de aceitação:**
1. O campo DEVE ser renderizado em SVG com proporções reais: 120 × 53.3 jardas (incluindo end zones), com linhas de jarda a cada 10 jardas.
2. CADA jogador DEVE ser um elemento SVG (círculo) posicionado pelas coordenadas reais `(x, y)`.
3. Os grupos DEVEM ser visualmente distinguíveis por cor/legenda: **QB**, **ataque (demais)**, **defesa – pass rush**, **defesa – outros**, **bola**.
4. A bola (`team = football`, `nflId` vazio) DEVE ser renderizada com marcador próprio.
5. DEVE existir uma legenda explicando cada cor/símbolo.
6. Jogadores DEVEM ter identificação acessível (número da camisa e/ou nome via tooltip/hover), sem poluir o campo.

### RF3 — Reprodução frame a frame

**História:** Como analista, quero reproduzir a movimentação dos jogadores ao longo dos frames.

**Critérios de aceitação:**
1. QUANDO o usuário aciona "Play", ENTÃO as posições SVG dos jogadores atualizam sequencialmente pelos `frameId`, respeitando a cadência de 10 Hz (ajustável por controle de velocidade).
2. As posições em cada frame DEVEM corresponder exatamente aos dados de tracking daquele `frameId` (sem interpolação inventada; se houver interpolação para suavização visual, deve ser opcional e documentada).
3. A animação DEVE parar automaticamente no último frame da jogada.

### RF4 — Controles de reprodução (pausar, avançar, retroceder)

**História:** Como analista, quero pausar, avançar e retroceder a reprodução para inspecionar momentos específicos.

**Critérios de aceitação:**
1. DEVE haver controles: Play/Pause, avançar 1 frame, retroceder 1 frame.
2. DEVE haver uma timeline (slider) que permita saltar (scrub) para qualquer frame; o campo atualiza para o frame selecionado.
3. O frame atual e o total de frames DEVEM ser exibidos numericamente (ex.: "frame 12 / 43").
4. DEVE haver controle de velocidade de reprodução (ex.: 0.5x, 1x, 2x).

### RF5 — Identificação dos pass rushers

**História:** Como analista, quero identificar quem são os pass rushers na jogada.

**Critérios de aceitação:**
1. Os jogadores com `pff_role = "Pass Rush"` (de `pffScoutingData.csv`) DEVEM ser destacados visualmente e listados no painel lateral.
2. A identificação de pass rusher DEVE vir exclusivamente de `pffScoutingData.csv` (não inferida de posição ou movimento).
3. SE uma jogada não tiver nenhum pass rusher registrado, ENTÃO a interface indica essa ausência explicitamente (P4).

### RF6 — Distância QB ↔ pass rusher mais próximo

**História:** Como analista, quero ver a distância entre o QB e o pass rusher mais próximo ao longo do tempo.

**Critérios de aceitação:**
1. Para cada frame, o app DEVE calcular a distância euclidiana em jardas entre o QB e CADA pass rusher, usando `(x, y)` reais: `d = √((x_qb − x_r)² + (y_qb − y_r)²)`.
2. A métrica de "distância ao pass rusher mais próximo" DEVE considerar **apenas** defensores com `pff_role = "Pass Rush"` (requisito analítico explícito).
3. O valor da distância mínima do frame atual DEVE ser exibido numericamente (em jardas) e o rusher correspondente identificado.
4. DEVE haver indicação visual (ex.: linha entre QB e rusher mais próximo) no frame atual.
5. Esta métrica DEVE ser rotulada como **"aproximação geométrica"**, nunca como "pressão" (P1, P5).
6. SE o QB ou os rushers não tiverem posição em um frame, ENTÃO a distância daquele frame é marcada como indisponível (P4), sem valor inventado.

### RF7 — Marcação de eventos (snap, lançamento, fim da jogada)

**História:** Como analista, quero ver quando ocorrem o snap, o lançamento e o encerramento da jogada.

**Critérios de aceitação:**
1. O app DEVE marcar na timeline o frame de **snap** (`ball_snap`, com fallback `autoevent_ballsnap`) e o de **lançamento** (`pass_forward`, fallback `autoevent_passforward`).
2. Eventos de encerramento disponíveis (ex.: `qb_sack`, `pass_outcome_caught`, `pass_outcome_incomplete`, `tackle`, `out_of_bounds`) DEVEM ser marcados quando presentes.
3. Quando um evento for derivado de `autoevent_*`, a interface DEVE sinalizar que é evento **automático** (estimado), diferenciando-o do anotado.
4. SE um evento (ex.: lançamento) não existir na jogada, ENTÃO a interface exibe isso claramente (P4), ex.: "Lançamento não registrado (possível sack/scramble)".

### RF8 — Estatísticas da jogada

**História:** Como analista, quero ver as estatísticas da jogada em três camadas distintas.

**Critérios de aceitação:**
1. O painel DEVE mostrar, em seções separadas e rotuladas:
   - **Contexto:** quarter, down, yardsToGo, times, `offenseFormation`, `pff_passCoverage`, `pff_passCoverageType`, nº de pass rushers.
   - **Pressão registrada pela PFF:** contagem de `pff_hit`, `pff_hurry`, `pff_sack` na jogada, com atribuição ao(s) jogador(es) quando disponível.
   - **Resultado da jogada:** `passResult` (traduzido: Completo/Incompleto/Sack/Scramble/Interceptado), `playResult` (jardas).
2. As três seções DEVEM ser visualmente distintas (P1) e nunca combinadas em um único número-resumo.
3. Campos ausentes/`NA` DEVEM ser exibidos como "não disponível" (P4).
4. As métricas PFF DEVEM ter nota indicando que são avaliações proprietárias da PFF, não derivadas geometricamente (P3).

### RF9 — Painel de metodologia e limitações

**História:** Como avaliador do hackathon, quero entender a metodologia e as limitações para confiar nos números.

**Critérios de aceitação:**
1. A interface DEVE ter uma seção acessível (ex.: "Sobre / Metodologia") que explique: fonte dos dados, como QB e rushers são identificados, a fórmula de distância, e as limitações herdadas de `analise-inicial.md` (amostra parcial, ruído posicional, eventos automáticos, métricas PFF subjetivas, aproximação ≠ pressão).
2. A distinção das três camadas (P1) DEVE estar explicada nessa seção.

---

## Requisitos Não Funcionais

### RNF1 — Arquitetura simples e local
1. A aplicação DEVE rodar localmente com passos mínimos, servida por um servidor estático simples (ex.: `python -m http.server`).
2. NÃO DEVE exigir backend em runtime, banco de dados, nem build complexo obrigatório para o MVP.

### RNF2 — Pré-processamento em Python
1. Todo o processamento dos CSVs originais DEVE ser feito por script(s) Python, gerando artefatos JSON.
2. O pré-processamento DEVE usar apenas a biblioteca padrão do Python quando possível (csv, json), sem dependências pesadas obrigatórias.
3. Os scripts DEVEM ser reexecutáveis e idempotentes (regerar o JSON não corrompe os dados).

### RNF3 — Dados processados em JSON, sem CSV bruto no navegador
1. O navegador NÃO DEVE carregar os arquivos originais de tracking (que somam ~800 MB).
2. Cada jogada processada DEVE ter um JSON próprio, contendo apenas os dados necessários daquela jogada (frames, jogadores, eventos, distâncias pré-computadas, metadados).
3. O tamanho de cada JSON de jogada DEVE ser adequado a carregamento rápido no navegador (alvo: dezenas de KB por jogada).

### RNF4 — Extensibilidade (adicionar jogadas sem reescrever a interface)
1. Adicionar uma nova jogada DEVE consistir em: rodar o script Python com novos `gameId/playId` e atualizar o índice — sem editar HTML/JS da interface.
2. A interface DEVE descobrir as jogadas disponíveis a partir do `plays_index.json`.

### RNF5 — Tecnologias da interface
1. A interface DEVE usar HTML, CSS e JavaScript (sem framework pesado obrigatório para o MVP).
2. A representação do campo e dos jogadores DEVE usar **SVG**, com posições atualizáveis por frame.

### RNF6 — Integridade dos dados originais
1. Os arquivos originais do dataset (`data/`) NÃO DEVEM ser modificados. Todos os artefatos gerados vão para um diretório separado do app.

### RNF7 — Documentação
1. O projeto DEVE incluir um README com instruções claras de instalação, pré-processamento e execução.
2. O README DEVE indicar como adicionar novas jogadas.

### RNF8 — Verificabilidade
1. As distâncias exibidas DEVEM ser reproduzíveis a partir das coordenadas no JSON (um avaliador pode recomputar `d` e conferir).
2. O JSON DEVE preservar `gameId`, `playId`, `nflId` e `frameId` para rastreabilidade até os dados originais.

---

## Fora de escopo (para este MVP)
- Modelos preditivos / machine learning de pressão.
- Análises agregadas entre muitas jogadas (rankings de temporada) — podem ser fase futura.
- Métricas de causalidade ou "probabilidade de sack".
- Reconstrução de duelos rusher×bloqueador (o gap de ~3,3% em `pff_nflIdBlockedPlayer` fica documentado, mas não é feature do MVP).

## Rastreabilidade
Todos os requisitos derivam de dados **verificados** em `analise-inicial.md`: identificação de QB/rushers via `pff_role`, distância por `(x,y)`, eventos via coluna `event`, e estatísticas via `pffScoutingData.csv` + `plays.csv`. Nenhum requisito depende de dado inexistente no dataset.
