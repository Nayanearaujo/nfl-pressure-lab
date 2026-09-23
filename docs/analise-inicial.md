# NFL Pressure Lab — Análise Inicial de Viabilidade

Projeto para o **Hackathon NFL Big Data Bowl RJ — AWS, NFL & Estácio**.
Objetivo desta investigação: avaliar se é possível construir o **NFL Pressure Lab**, uma aplicação para analisar como a defesa pressiona o quarterback (QB) e como essa pressão se relaciona com o resultado das jogadas.

> **Escopo desta entrega:** apenas investigação de viabilidade. Nenhum arquivo original foi modificado e a aplicação **não** foi desenvolvida. Todas as afirmações abaixo foram verificadas diretamente contra os dados (temporada 2021, semanas 1–8: 122 jogos, 8.557 jogadas, 1.679 jogadores).

---

## 1. Como localizar o Quarterback e o Pass Rush

A identificação vem de `pffScoutingData.csv`, pela coluna `pff_role`, cruzando `gameId` + `playId` + `nflId`.

**Distribuição real de `pff_role` (188.254 linhas):**

| pff_role     | linhas  | uso no projeto |
|--------------|---------|----------------|
| Coverage     | 57.765  | defensores em cobertura |
| Pass Block   | 46.057  | linha ofensiva / protetores |
| Pass Route   | 39.513  | recebedores |
| **Pass Rush**| 36.362  | **defensores que pressionam o QB** |
| **Pass**     | 8.557   | **o quarterback (passador)** |

**Verificação-chave:**
- **Todas as 8.557 jogadas têm exatamente 1 jogador com `pff_role = Pass`** → o QB é identificável em 100% das jogadas (0 jogadas sem QB).
- `pff_positionLinedUp = "QB"` também aparece 8.557 vezes, confirmando a consistência.
- O `nflId` do QB e dos pass rushers pode ser cruzado com `players.csv` (posição, nome) e com os arquivos de tracking.

**Número de pass rushers por jogada (verificado):**

| rushers | jogadas |
|---------|---------|
| 3       | 420     |
| 4       | 6.011   |
| 5       | 1.689   |
| 6       | 348     |
| 7       | 69      |
| 1–2 / 8 | 19      |

A distribuição é coerente com o futebol americano real (4 rushers é o padrão; 5+ indica blitz). Isso permite classificar jogadas por intensidade de pressão de forma confiável.

---

## 2. Distância QB ↔ Defensores ao longo do tempo — **VIÁVEL (testado)**

Os arquivos `tracking/tracking_[gameId].csv` fornecem posição `(x, y)` em jardas, a **10 frames por segundo**, para cada jogador e para a bola, com `frameId` sequencial por jogada.

**Teste end-to-end executado** na jogada `gameId=2021090900, playId=97` (passe de Tom Brady):
1. Identificado o QB (`nflId=25511`) e os 5 pass rushers via `pffScoutingData.csv`.
2. Carregadas as posições frame a frame do tracking.
3. Calculada a distância euclidiana `√((x_qb − x_def)² + (y_qb − y_def)²)` entre QB e cada rusher.

**Resultado obtido:**
- No **snap** (frame 6): rusher mais próximo a **5,78 jardas** do QB.
- No **lançamento** (frame 40): rusher mais próximo a **1,79 jarda** do QB.

Ou seja, é possível medir a **evolução da distância ao longo do tempo** e capturar exatamente o "fechamento do cerco" sobre o QB. Também estão disponíveis por frame: velocidade (`s`), aceleração (`a`), orientação (`o`) e direção do movimento (`dir`) — úteis para métricas de aproximação.

> Observação: a linha da **bola** (`team = football`, `nflId` vazio) permite localizar a bola/pocket como referência alternativa ao QB.

---

## 3. Dados sobre sacks, hits, hurries e resultados de passe

### 3.1. Nível jogador (`pffScoutingData.csv`) — indicadores binários por defensor
Totais verificados no dataset completo:
- **Hits:** 843 linhas com `pff_hit = 1`
- **Hurries:** 2.877 linhas com `pff_hurry = 1`
- **Sacks:** 602 linhas com `pff_sack = 1`

Do lado ofensivo há os espelhos: `pff_hitAllowed`, `pff_hurryAllowed`, `pff_sackAllowed` e `pff_beatenByDefender`, além de `pff_nflIdBlockedPlayer` (quem cada bloqueador enfrentou). Isso permite atribuir **responsabilidade** da pressão a rushers e a bloqueadores individuais.

### 3.2. Nível jogada (`plays.csv`) — resultado do passe (`passResult`)
Distribuição verificada (8.557 jogadas):

| passResult | jogadas | significado |
|------------|---------|-------------|
| C          | 4.620   | passe completo |
| I          | 2.755   | passe incompleto |
| S          | 543     | sack |
| R          | 449     | scramble |
| IN         | 190     | interceptação |

Colunas complementares de resultado: `playResult` e `prePenaltyPlayResult` (jardas ganhas), `down`, `yardsToGo`, `offenseFormation`, `personnelD`, `defendersInBox`, `pff_passCoverage`/`pff_passCoverageType` (100% preenchidas — 0 NA) e `pff_playAction`.

**Conclusão:** dá para conectar pressão (rush/hit/hurry/sack) ao desfecho da jogada (completo, incompleto, sack, interceptação, jardas) de forma direta.

---

## 4. Identificação do snap e do lançamento da bola — **VIÁVEL**

A coluna `event` do tracking marca os momentos-chave. Verificação no jogo `2021090900` (97 jogadas):
- **Snap:** `ball_snap` (anotado) ou `autoevent_ballsnap` (automático). **97/97 jogadas têm um evento de snap.**
- **Lançamento:** `pass_forward` (anotado) ou `autoevent_passforward` (automático). **94/97 jogadas têm evento de lançamento** (as 3 sem lançamento tendem a ser sacks/scrambles/corridas — coerente).
- Outros eventos úteis: `pass_arrived`, `pass_outcome_caught`, `pass_outcome_incomplete`, `qb_sack`, `fumble`.

Assim é possível recortar a "janela de pressão" entre **snap → lançamento (ou sack)** e medir o **time-to-throw** e o **time-to-pressure**.

> Recomendação: priorizar o evento anotado (`ball_snap`, `pass_forward`) e usar o `autoevent_*` como fallback quando o anotado não existir.

---

## 5. Três análises propostas (com dados que já existem)

**Análise A — "Time to Pressure" vs. resultado do passe.**
Para cada jogada, medir os frames entre o snap e o instante em que o rusher mais próximo cruza um limiar de distância do QB (ex.: entra na pocket). Cruzar com `passResult`. Hipótese: pressão mais rápida → mais incompletos/sacks/interceptações. *(Usa: tracking `x,y` + eventos + `passResult`.)*

**Análise B — Blitz (5+ rushers) vs. cobertura e eficácia.**
Classificar jogadas por nº de `Pass Rush` e cruzar com `pff_passCoverage`/`pff_passCoverageType`, `pff_playAction`, `defendersInBox` e o desfecho (`passResult`, `playResult`). Pergunta: blitz gera mais sacks/hurries — e a que custo em jardas concedidas quando falha? *(Usa: `pffScoutingData` + `plays`.)*

**Análise C — Ranking de rushers e matchups de bloqueio.**
Agregar por `nflId` a taxa de hit/hurry/sack por snap de rush, e usar `pff_nflIdBlockedPlayer` + `pff_...Allowed` para reconstruir duelos rusher × bloqueador. Combinar com velocidade/aceleração de aproximação do tracking. *(Usa: `pffScoutingData` + `players` + tracking.)*

---

## 6. Limitações, dados ausentes e riscos de interpretação

- **Amostra parcial da temporada:** apenas semanas 1–8 de 2021. Conclusões não representam a temporada inteira nem outras temporadas.
- **`dropBackType` com 528 NA** (~6% das jogadas) e categoria `SCRAMBLE`/`DESIGNED_RUN` presente — filtrar corretamente jogadas de passe é necessário antes de análises de pressão.
- **Sem lançamento em algumas jogadas:** ~3/97 no jogo amostrado não têm `pass_forward` (sacks/scrambles). Usar `qb_sack`/`passResult=S` para tratar esses casos.
- **`pff_nflIdBlockedPlayer` ausente em ~3,3%** das linhas de Pass Block — reconstruir todos os duelos rusher×bloqueador não será 100% completo.
- **Métricas PFF são subjetivas/proprietárias:** "hit", "hurry", "hurryAllowed" seguem critérios da PFF, não fórmulas geométricas do tracking. Não devem ser tratadas como verdade física derivada de `x,y`.
- **`o` (orientação) ≠ `dir` (direção do movimento):** confundi-los gera erro. Orientação é para onde o corpo aponta; direção é para onde ele se move.
- **Sincronização evento↔frame:** eventos `autoevent_*` são estimados por algoritmo e podem divergir alguns frames do momento real.
- **Ruído posicional:** o tracking tem pequenas imprecisões; distâncias devem usar limiares/suavização, não valores exatos ponto a ponto.
- **`playId` não é único entre jogos** — sempre juntar por `gameId` + `playId`.
- **Não inventar métricas:** qualquer índice de pressão criado pela aplicação deve ser rotulado como métrica derivada nossa, distinta das colunas oficiais da NFL/PFF.

---

## 7. Funcionalidade visual sugerida (tracking)

**"Pocket Replay" — replay 2D animado da jogada.**
Renderizar o campo (x: 0–120, y: 0–53.3) e animar, frame a frame (10 Hz), as bolinhas dos jogadores: ofensivos, defensivos (pass rushers destacados) e a bola. Recursos:
- Linhas ligando o QB a cada rusher, com **cor/espessura proporcional à distância** (quanto mais perto, mais "quente").
- **Timeline** marcando `ball_snap` e `pass_forward`, com scrubbing.
- Vetores opcionais de direção (`dir`) e velocidade (`s`) por jogador.
- Painel lateral com a distância mínima QB↔rusher em tempo real e o `passResult` ao final.

Todos os dados necessários (posição, tempo, eventos, papéis) já existem e foram validados nesta análise.

---

## 8. Resumo das principais descobertas

1. **QB identificável em 100% das jogadas** (`pff_role = Pass`, 8.557/8.557) e **pass rushers identificáveis** (`pff_role = Pass Rush`), com contagem de rushers coerente com blitz/pressão.
2. **Cálculo de distância QB↔defensor ao longo do tempo é viável** — testado end-to-end (5,78 jd no snap → 1,79 jd no lançamento numa jogada real).
3. **Sacks, hits, hurries e resultados de passe estão disponíveis** em dois níveis (jogador via PFF; jogada via `passResult`), permitindo ligar pressão a desfecho.
4. **Snap e lançamento são localizáveis** via `event` (`ball_snap`/`pass_forward`, com fallback `autoevent_*`), cobrindo praticamente todas as jogadas.
5. **Cobertura defensiva 100% preenchida** (`pff_passCoverage`), boa para segmentar análises.

### Recomendação — o que dá para implementar com segurança
- ✅ **Pocket Replay 2D** com destaque de pressão (Seção 7) — todos os dados validados.
- ✅ **Métrica "Time to Pressure" e "Time to Throw"** por jogada, a partir de eventos + tracking.
- ✅ **Dashboard pressão × resultado** (blitz vs. `passResult`/`playResult`, filtrando por cobertura).
- ✅ **Ranking de rushers** (hit/hurry/sack por snap) e duelos rusher×bloqueador (ciente do gap de ~3,3%).
- ⚠️ Sempre **filtrar jogadas de passe** (tratar `SCRAMBLE`/`DESIGNED_RUN`/`dropBackType=NA`) e **rotular métricas derivadas** como nossas, distintas das oficiais PFF/NFL.

*Fontes: `data-reference.md` + verificação direta em `plays.csv`, `pffScoutingData.csv` e `tracking/tracking_2021090900.csv`. Nenhum arquivo original foi alterado.*
