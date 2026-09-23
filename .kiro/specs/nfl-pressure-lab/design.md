# NFL Pressure Lab — Design

**Base:** `requirements.md` (mesma spec), `data-reference.md`, `analise-inicial.md`.
Este documento define arquitetura, fluxo de dados, esquema dos JSON, interface e estratégia de visualização SVG, além da metodologia de identificação de jogadores, cálculo de distância e sincronização de frames.

---

## 1. Visão de arquitetura

Arquitetura em **duas fases desacopladas**, sem backend em runtime:

```
┌─────────────────────────────────────────────────────────────┐
│  FASE 1 — PRÉ-PROCESSAMENTO (Python, offline, roda 1x)         │
│                                                                │
│  data/plays.csv ─┐                                             │
│  data/pffScoutingData.csv ─┤──► preprocess.py ──► JSON         │
│  data/tracking/tracking_[gameId].csv ─┘        (por jogada)    │
│  data/players.csv ─┘                                           │
└─────────────────────────────────────────────────────────────┘
                              │  gera
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  app/data/plays_index.json                                     │
│  app/data/plays/<gameId>_<playId>.json  (1 por jogada)         │
└─────────────────────────────────────────────────────────────┘
                              │  servido estaticamente
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE 2 — INTERFACE (navegador: HTML + CSS + JS + SVG)         │
│                                                                │
│  index.html ──► app.js ──► fetch(plays_index.json)            │
│                        └─► fetch(plays/<id>.json)             │
│                        └─► FieldRenderer (SVG)                │
│                        └─► PlaybackController (timeline)      │
│                        └─► StatsPanel (3 camadas)            │
└─────────────────────────────────────────────────────────────┘
```

**Justificativa:** atende RNF1 (local, sem backend), RNF3 (navegador não lê CSV bruto de ~800 MB), RNF4 (nova jogada = rodar Python + índice, sem tocar na UI).

### Estrutura de diretórios proposta (fora de `data/`, preservando os originais — RNF6)

```
nfl-pressure-lab/                 # raiz do app (novo diretório)
├── preprocess.py                 # script de pré-processamento
├── README.md                     # instalação e execução
├── app/
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js                # bootstrap + seleção de jogada
│   │   ├── field-renderer.js     # SVG do campo e jogadores
│   │   ├── playback.js           # controles + timeline + loop de frames
│   │   └── stats-panel.js        # painéis de contexto/PFF/resultado
│   └── data/
│       ├── plays_index.json      # índice de jogadas (gerado)
│       └── plays/
│           └── <gameId>_<playId>.json   # dados por jogada (gerado)
```

> O caminho para os CSVs originais (`../data/…` relativo ao repo) é um parâmetro do `preprocess.py`, não fica hardcoded na UI.

---

## 2. Fluxo de processamento dos dados (Fase 1)

O `preprocess.py` recebe uma lista de jogadas-alvo `(gameId, playId)` (via CLI ou arquivo de configuração) e, para cada uma:

**Passo 1 — Carregar contexto da jogada** (`plays.csv`, filtro por `gameId`+`playId`):
- Extrai: quarter, down, yardsToGo, possessionTeam, defensiveTeam, playDescription, offenseFormation, personnelD, defendersInBox, dropBackType, pff_playAction, pff_passCoverage, pff_passCoverageType, passResult, playResult, prePenaltyPlayResult.

**Passo 2 — Identificar papéis** (`pffScoutingData.csv`, filtro por `gameId`+`playId`):
- **QB:** o `nflId` com `pff_role == "Pass"` (garantidamente 1 por jogada — verificado em `analise-inicial.md`).
- **Pass rushers:** conjunto de `nflId` com `pff_role == "Pass Rush"`.
- Guarda também `pff_role` e `pff_positionLinedUp` de cada jogador para a legenda.
- Coleta indicadores de pressão PFF por jogador: `pff_hit`, `pff_hurry`, `pff_sack`.

**Passo 3 — Enriquecer com `players.csv`** (join por `nflId`):
- displayName, officialPosition, jerseyNumber (o jersey também vem do tracking).

**Passo 4 — Extrair tracking** (`tracking/tracking_<gameId>.csv`, filtro por `playId`):
- Para cada linha: `frameId`, `nflId` (ou bola), `team`, `x`, `y`, `s`, `a`, `o`, `dir`, `event`, `jerseyNumber`, `playDirection`.
- Reorganiza por frame: `frames[frameId] = { players: {nflId: {x,y,s,dir,o}}, ball: {x,y}, event }`.

**Passo 5 — Detectar eventos-chave** (varredura da coluna `event`):
- `snapFrame` = primeiro frame com `ball_snap`; fallback `autoevent_ballsnap` (marcado como automático).
- `throwFrame` = primeiro frame com `pass_forward`; fallback `autoevent_passforward` (automático). Pode ser `null`.
- `endFrame` = primeiro frame com evento de encerramento conhecido (`qb_sack`, `pass_outcome_caught`, `pass_outcome_incomplete`, `tackle`, `out_of_bounds`, `fumble`), se houver.
- Cada evento guarda `{frame, source: "annotated"|"autoevent"}` ou ausência explícita.

**Passo 6 — Pré-computar distâncias** (metodologia na Seção 5):
- Para cada frame, distância QB↔cada rusher e a mínima (com o `nflId` do rusher mais próximo).
- Guardado no JSON para verificabilidade (RNF8) e para não recalcular pesado no navegador.

**Passo 7 — Serializar** o JSON da jogada e atualizar `plays_index.json`.

**Tratamento de ausências (P4):** valores `NA`/vazios viram `null` no JSON (nunca `0` silencioso). O front decide como exibir "não disponível".

---

## 3. Metodologia de identificação de jogadores

| Alvo | Fonte | Regra | Verificado |
|------|-------|-------|-----------|
| Quarterback | `pffScoutingData.csv` | único `nflId` com `pff_role = "Pass"` | 8.557/8.557 jogadas têm exatamente 1 (analise-inicial §1) |
| Pass rushers | `pffScoutingData.csv` | todos `nflId` com `pff_role = "Pass Rush"` | distribuição 3–7 por jogada (analise-inicial §1) |
| Ataque (demais) | tracking + pff | `team == possessionTeam` e não é o QB | — |
| Defesa (outros) | tracking + pff | `team == defensiveTeam` e não é rusher | — |
| Bola | tracking | `team == "football"` (nflId vazio) | 4.028 linhas de bola no jogo amostrado |

**Regra rígida (requisito analítico):** a métrica de "distância ao pass rusher mais próximo" usa **somente** o conjunto de `pff_role = "Pass Rush"`. Defensores em cobertura que porventura se aproximem do QB **não** entram nessa métrica.

---

## 4. Cálculo de distância

**Fórmula (euclidiana, em jardas):**
```
d(frame) = min sobre rushers r de  sqrt( (x_qb − x_r)² + (y_qb − y_r)² )
```
onde `(x_qb, y_qb)` e `(x_r, y_r)` são as coordenadas do QB e do rusher naquele `frameId`.

**Decisões metodológicas:**
- Unidade: jardas (as coordenadas do tracking já estão em jardas).
- Usa-se a posição do **QB** como referência (não a bola), consistente com o requisito "distância entre QB e pass rusher". A bola é renderizada, mas a métrica é QB-cêntrica.
- **Sem suavização por padrão.** Se for oferecida suavização visual (ex.: média móvel para o gráfico), ela é claramente rotulada e não altera os valores por frame armazenados (RNF8). O ruído posicional é uma limitação documentada (analise-inicial §6).
- **Frames com dados faltantes:** se QB ou todos os rushers não têm posição no frame → `distance_min = null` (P4). Se apenas alguns rushers faltam, calcula com os disponíveis.
- **Não é pressão (P5).** O JSON e a UI nomeiam este campo `geometric_min_distance_yd` / "aproximação geométrica", nunca "pressão".

**Verificação de referência (analise-inicial §2):** na jogada `2021090900 / 97`, o pipeline produziu 5,78 jd no snap e 1,79 jd no lançamento. Esse caso serve como **teste de aceitação do pré-processamento** (o JSON gerado deve reproduzir esses valores).

---

## 5. Sincronização de frames

- A unidade temporal canônica é o **`frameId`** (inteiro, começa em 1, 10 Hz). Toda a UI (timeline, distância, eventos) é indexada por `frameId`.
- Cada frame do JSON é um objeto autocontido com posições de todos os jogadores + bola + evento daquele frame + distância pré-computada. Assim, saltar (scrub) para um frame é O(1): basta ler `frames[i]`.
- O `time` (timestamp UTC) é preservado para referência, mas a reprodução usa `frameId` + intervalo derivado da velocidade escolhida (100 ms por frame em 1x).
- **Alinhamento evento↔frame:** os frames de `snapFrame`/`throwFrame`/`endFrame` referenciam diretamente índices de `frames`, então marcadores da timeline e destaque no campo ficam sincronizados por construção.
- **Ordenação:** o pré-processamento ordena por `frameId` crescente e valida continuidade (sem buracos). Buracos, se existirem, são registrados em `meta.warnings`.

---

## 6. Estrutura dos arquivos JSON

### 6.1. `plays_index.json` (índice — alimenta RF1 e RNF4)

```json
{
  "generatedAt": "2026-09-23T00:00:00Z",
  "datasetNote": "NFL Big Data Bowl 2023 — temporada 2021, semanas 1-8",
  "plays": [
    {
      "id": "2021090900_97",
      "gameId": 2021090900,
      "playId": 97,
      "week": 1,
      "possessionTeam": "TB",
      "defensiveTeam": "DAL",
      "quarter": 1,
      "down": 3,
      "yardsToGo": 2,
      "passResult": "I",
      "description": "(13:33) (Shotgun) T.Brady pass incomplete deep right to C.Godwin.",
      "file": "plays/2021090900_97.json"
    }
  ]
}
```

### 6.2. `plays/<gameId>_<playId>.json` (dados da jogada)

```json
{
  "meta": {
    "id": "2021090900_97",
    "gameId": 2021090900,
    "playId": 97,
    "week": 1,
    "playDirection": "right",
    "frameCount": 43,
    "frameRateHz": 10,
    "fieldDims": { "length": 120, "width": 53.3 },
    "warnings": []
  },
  "context": {
    "possessionTeam": "TB",
    "defensiveTeam": "DAL",
    "quarter": 1,
    "down": 3,
    "yardsToGo": 2,
    "offenseFormation": "SHOTGUN",
    "personnelD": "4 DL, 2 LB, 5 DB",
    "defendersInBox": 6,
    "dropBackType": "TRADITIONAL",
    "pff_playAction": 0,
    "pff_passCoverage": "Cover-1",
    "pff_passCoverageType": "Man"
  },
  "result": {
    "passResult": "I",
    "passResultLabel": "Incompleto",
    "playResult": 0,
    "prePenaltyPlayResult": 0
  },
  "players": [
    {
      "nflId": 25511,
      "displayName": "Tom Brady",
      "position": "QB",
      "jerseyNumber": 12,
      "team": "TB",
      "side": "offense",
      "pffRole": "Pass",
      "isQB": true,
      "isPassRusher": false,
      "pffPressure": { "hit": null, "hurry": null, "sack": null }
    },
    {
      "nflId": 44955,
      "displayName": "…",
      "position": "DE",
      "jerseyNumber": 90,
      "team": "DAL",
      "side": "defense",
      "pffRole": "Pass Rush",
      "isQB": false,
      "isPassRusher": true,
      "pffPressure": { "hit": 0, "hurry": 0, "sack": 0 }
    }
  ],
  "events": {
    "snap":  { "frame": 6,  "source": "annotated" },
    "throw": { "frame": 40, "source": "annotated" },
    "end":   { "frame": 43, "type": "pass_outcome_incomplete", "source": "annotated" }
  },
  "frames": [
    {
      "frameId": 1,
      "event": null,
      "ball": { "x": 37.5, "y": 24.0 },
      "positions": {
        "25511": { "x": 37.77, "y": 24.22, "s": 0.29, "dir": 84.99, "o": 165.16 },
        "44955": { "x": 43.1,  "y": 22.0,  "s": 0.1,  "dir": 270.0, "o": 90.0 }
      },
      "geometric_min_distance_yd": 5.90,
      "closest_rusher_nflId": 44955
    }
  ],
  "pressureSummary": {
    "note": "Contagens de avaliações PFF; NÃO derivadas de geometria.",
    "hits": 0, "hurries": 0, "sacks": 0,
    "byPlayer": []
  }
}
```

**Observações de esquema:**
- `positions` é um mapa `nflId → {x,y,s,dir,o}` para lookup O(1) por jogador no render.
- `pffPressure` e `pressureSummary` guardam `null` quando `NA` (P4) e trazem a nota de que são avaliações PFF (P3, RF8.4).
- `geometric_min_distance_yd` é a **aproximação geométrica** (P5), pré-computada e verificável (RNF8).
- Nenhum campo agrega "aproximação + PFF + resultado"; as três camadas ficam em blocos separados (`frames`/`geometric…`, `pressureSummary`, `result`) — atende P1.

---

## 7. Interface (Fase 2)

### 7.1. Layout
```
┌───────────────────────────────────────────────────────────┐
│  Header: NFL Pressure Lab  |  [Seletor de jogada ▼]         │
├──────────────────────────────────────┬────────────────────┤
│                                        │  PAINEL LATERAL     │
│   CAMPO SVG (120 x 53.3)               │  ── Contexto        │
│   • jogadores (círculos)               │  ── Aproximação     │
│   • bola                               │     geométrica      │
│   • linha QB↔rusher mais próximo       │     (dist. atual)   │
│                                        │  ── Pressão PFF     │
│                                        │  ── Resultado       │
├──────────────────────────────────────┴────────────────────┤
│  TIMELINE:  |◀ ◀ ▶/⏸ ▶|  [====slider====]  frame 12/43      │
│  marcadores: ▲snap  ▲lançamento  ▲fim   velocidade [1x ▼]   │
├───────────────────────────────────────────────────────────┤
│  Rodapé: "Sobre / Metodologia e Limitações"                 │
└───────────────────────────────────────────────────────────┘
```

### 7.2. Componentes JS (vanilla, sem framework — RNF5)
- **`app.js`** — carrega `plays_index.json`, popula o seletor, orquestra o carregamento da jogada selecionada e injeta os dados nos demais módulos.
- **`field-renderer.js`** — cria o SVG do campo uma vez; expõe `renderFrame(frameData)` que atualiza atributos `cx`/`cy` dos círculos (ver Seção 8). Destaca rushers e desenha a linha QB↔rusher mais próximo.
- **`playback.js`** — mantém `currentFrame`, timer de reprodução, botões, slider e velocidade; emite eventos de "frame mudou" que o renderer e o painel consomem.
- **`stats-panel.js`** — renderiza os três blocos separados (P1) e o valor de distância do frame atual; aplica rótulos de ausência (P4).

### 7.3. Diferenciação das três camadas na UI (P1)
- **Aproximação geométrica:** cor neutra (ex.: azul), rótulo "Aproximação geométrica (calculada de x,y)". Mostra a distância do frame + mínimo da jogada.
- **Pressão PFF:** bloco separado com selo "Fonte: PFF (avaliação)", contagens de hit/hurry/sack.
- **Resultado:** bloco com `passResult` traduzido + jardas.
- Um aviso curto e fixo reforça: *"Aproximação não implica pressão; pressão PFF é avaliação; nenhuma relação causal é afirmada."* (P2, P5).

---

## 8. Estratégia de visualização SVG

- **Coordenadas:** o campo é um `<svg viewBox="0 0 120 53.3">`. As coordenadas de tracking (`x`,`y` em jardas) mapeiam **diretamente** para o espaço do viewBox — sem conversão manual de escala — e o CSS dimensiona o SVG responsivamente. O eixo `y` do SVG cresce para baixo; aplica-se `transform` para orientar o campo de forma natural (ou inverte-se `y` no render), decisão documentada no código.
- **Jogadores:** um `<circle>` por jogador, agrupados em `<g id="players">`. Cada círculo tem `data-nflid`. Classes CSS por categoria (`.qb`, `.offense`, `.rusher`, `.defense`, `.ball`).
- **Atualização por frame (RNF5.2):** `renderFrame` percorre `frame.positions` e seta `cx`/`cy` de cada círculo existente (elementos criados uma vez, reusados). Isso mantém o DOM estável e a animação leve. Sem recriar nós a cada frame.
- **Animação:** `playback.js` usa `requestAnimationFrame` com acumulador de tempo para respeitar 100 ms/frame (1x). Opcionalmente, transição CSS curta entre frames para suavizar (não altera dados).
- **Linha de aproximação:** um `<line>` do QB ao `closest_rusher_nflId` do frame, com rótulo da distância. Cor/espessura variam com a distância apenas como recurso visual, sempre com o rótulo "aproximação geométrica".
- **Marcadores de campo:** linhas de jarda a cada 10 jd, números, e as zonas 0–10 / 110–120 sombreadas como end zones. Linha de scrimmage opcional via `absoluteYardlineNumber`.
- **Acessibilidade/leitura:** tooltip on hover com nome, posição e número; legenda fixa.

---

## 9. Como o design honra os princípios inegociáveis
- **P1 (três camadas):** JSON e UI mantêm blocos separados (`geometric…`, `pressureSummary`, `result`); Seção 7.3.
- **P2 (sem causalidade):** aviso fixo e linguagem descritiva; nenhum campo do tipo "pressão causou X".
- **P3 (sem invenção):** única métrica derivada é a distância euclidiana, com fórmula na Seção 4 e valores verificáveis (RNF8).
- **P4 (ausência explícita):** `NA` → `null`; UI mostra "não disponível"; eventos ausentes sinalizados (RF7.4).
- **P5 (aproximação ≠ pressão):** nome de campo e rótulos deixam explícito; nunca auto-rotula aproximação como pressão.

## 10. Estratégia de MVP → incremental (detalhada em `tasks.md`)
1. **MVP:** 1 jogada real (`2021090900 / 97`) processada, campo SVG estático + reprodução + distância + eventos + painel. Prova o pipeline ponta a ponta e o caso de verificação (5,78→1,79 jd).
2. **Incrementos:** múltiplas jogadas via índice; controles avançados (velocidade, scrub fino); painel de pressão PFF completo; seção de metodologia; polimento visual.
