# NFL Big Data Bowl — Referência dos Dados (data-reference.md)

Repositório: `ThompsonJamesBliss/nfl-big-data-bowl-regional-event-data`
Este é o dataset do **NFL Big Data Bowl 2023** (semanas 1–8 da temporada 2021).
Dados de tracking fornecidos pela equipe NFL Next Gen Stats; dados de scouting fornecidos pela [Pro Football Focus (PFF)](https://www.pff.com/).

> Observação sobre joins: `gameId` e `playId` deste dataset correspondem a `old_game_id` e `play_id` da play-by-play do [nflverse](https://nflverse.nflverse.com/).

---

## Estrutura de pastas e arquivos

```
nfl-big-data-bowl-regional-event-data/
├── README.md
└── data/
    ├── games.csv                 # 122 jogos
    ├── players.csv               # 1.679 jogadores
    ├── plays.csv                 # 8.557 jogadas
    ├── pffScoutingData.csv       # scouting por jogador/jogada (PFF)
    └── tracking/
        ├── tracking_2021090900.csv
        ├── tracking_2021091200.csv
        └── ...                    # 122 arquivos (1 por jogo), tracking_[gameId].csv
```

### Chaves de junção (join keys) entre arquivos

| Arquivo             | Chave(s)                        |
|---------------------|---------------------------------|
| games.csv           | `gameId`                        |
| plays.csv           | `gameId` + `playId`             |
| players.csv         | `nflId`                         |
| pffScoutingData.csv | `gameId` + `playId` + `nflId`   |
| tracking/*.csv      | `gameId` + `playId` + `nflId`   |

Para filtrar tracking por semana, junte `gameId` → `week` via `games.csv`.

---

## 1. games.csv — dados dos jogos

Um registro por jogo. Contém os times de cada partida.

| Coluna            | Tipo   | Significado |
|-------------------|--------|-------------|
| `gameId`          | num    | Identificador único do jogo (ex.: `2021090900`). Codifica a data no formato AAAAMMDD + sufixo. |
| `season`          | num    | Temporada do jogo (2021). |
| `week`            | num    | Semana do jogo (1–8). |
| `gameDate`        | data   | Data do jogo, formato `mm/dd/yyyy`. |
| `gameTimeEastern` | hora   | Horário de início, `HH:MM:SS` (fuso Leste dos EUA / EST). |
| `homeTeamAbbr`    | texto  | Sigla de 3 letras do time da casa (ex.: `TB`). |
| `visitorTeamAbbr` | texto  | Sigla de 3 letras do time visitante (ex.: `DAL`). |

---

## 2. players.csv — dados dos jogadores

Um registro por jogador que apareceu em qualquer arquivo de tracking.

| Coluna             | Tipo   | Significado |
|--------------------|--------|-------------|
| `nflId`            | num    | Identificador único do jogador (chave). |
| `height`           | texto  | Altura no formato `pés-polegadas` (ex.: `6-4`). |
| `weight`           | num    | Peso em libras (lbs). |
| `birthDate`        | data   | Data de nascimento, `YYYY-MM-DD`. |
| `collegeName`      | texto  | Faculdade do jogador. |
| `officialPosition` | texto  | Posição oficial (ver lista abaixo). |
| `displayName`      | texto  | Nome de exibição do jogador (ex.: `Tom Brady`). |

**Posições presentes no dataset:** WR, CB, DE, OLB, RB, T, TE, DT, G, ILB, FS, SS, QB, C, NT, MLB, FB, LB, DB.
(WR = wide receiver, CB = cornerback, DE = defensive end, OLB = outside linebacker, RB = running back, T = tackle, TE = tight end, DT = defensive tackle, G = guard, ILB/MLB = inside/middle linebacker, FS/SS = free/strong safety, QB = quarterback, C = center, NT = nose tackle, FB = fullback, LB = linebacker genérico, DB = defensive back genérico.)

---

## 3. plays.csv — dados das jogadas

Um registro por jogada (`gameId` + `playId`). `playId` **não** é único entre jogos.

| Coluna                   | Tipo   | Significado |
|--------------------------|--------|-------------|
| `gameId`                 | num    | Identificador do jogo. |
| `playId`                 | num    | Identificador da jogada (único dentro do jogo). |
| `playDescription`        | texto  | Descrição textual da jogada. |
| `quarter`                | num    | Quarto (período) do jogo. |
| `down`                   | num    | Down (1–4). |
| `yardsToGo`              | num    | Jardas necessárias para o first down. |
| `possessionTeam`         | texto  | Sigla do time em ataque (com posse de bola). |
| `defensiveTeam`          | texto  | Sigla do time em defesa. |
| `yardlineSide`           | texto  | Sigla do time referente ao lado da linha de scrimmage. |
| `yardlineNumber`         | num    | Número da linha de jardas na linha de scrimmage (0–50). |
| `gameClock`              | hora   | Tempo no relógio no início da jogada, `MM:SS`. |
| `preSnapHomeScore`       | num    | Placar do time da casa antes da jogada. |
| `preSnapVisitorScore`    | num    | Placar do time visitante antes da jogada. |
| `passResult`             | texto  | Resultado do dropback: `C` completo, `I` incompleto, `S` sack, `IN` interceptado, `R` scramble. |
| `penaltyYards`           | num    | Jardas ganhas pelo ataque por penalidade. |
| `prePenaltyPlayResult`   | num    | Jardas líquidas ganhas pelo ataque, **antes** de aplicar penalidade. |
| `playResult`             | num    | Jardas líquidas ganhas pelo ataque, **incluindo** penalidade. |
| `foulName1/2/3`          | texto  | Nome da i-ésima penalidade cometida na jogada (i = 1..3). |
| `foulNFLId1/2/3`         | num    | `nflId` do jogador que cometeu a i-ésima penalidade. |
| `absoluteYardlineNumber` | num    | Distância até a end zone para o time com posse (0–120, escala absoluta do campo). |
| `offenseFormation`       | texto  | Formação usada pelo ataque (ex.: SHOTGUN, EMPTY, SINGLEBACK, I_FORM, PISTOL, JUMBO). |
| `personnelO`             | texto  | Personnel do ataque (ex.: `1 RB, 1 TE, 3 WR`). |
| `defendersInBox`         | num    | Nº de defensores próximos à linha de scrimmage ("na caixa"). |
| `personnelD`             | texto  | Personnel da defesa (ex.: `4 DL, 2 LB, 5 DB`). |
| `dropBackType`           | texto  | Categorização do dropback do QB (ex.: TRADITIONAL, DESIGNED_ROLLOUT, SCRAMBLE, etc.). |
| `pff_playAction`         | binário| 1 se o ataque executou play action fake; 0 caso contrário (PFF). |
| `pff_passCoverage`       | texto  | Esquema de cobertura da defesa (PFF) — valores abaixo. |
| `pff_passCoverageType`   | texto  | Tipo de cobertura: man, zone ou other (PFF). |

**Valores de `pff_passCoverage`:**
- `Cover-0`: man-to-man geral, sem defensores profundos; geralmente acompanha blitz.
- `Cover-1`: man defense com um safety profundo único ("single high").
- `Cover-2`: dois safeties profundos com princípio de zona.
- `2-Man`: dois safeties profundos com princípio de marcação individual (man).
- `Cover-3`: conceito 3 profundos, 4 embaixo (underneath).
- `Quarters`: conceito de quartos nos dois lados (geralmente 4 profundos, 3 embaixo).
- `Cover-6`: quartos em metade do campo e Cover-2 na outra metade.
- `Bracket`: dois defensores fazendo "bracket" (dentro/fora) sobre dois atacantes.
- `Goal Line`: defesa específica de goal line.
- `Red Zone`: coberturas típicas de red zone.
- `Prevent`: defesa prevent (fim de tempo/jogo).
- `Miscellaneous`: coberturas que não se encaixam nas categorias acima.

---

## 4. pffScoutingData.csv — dados de scouting (PFF)

Um registro por jogador em cada jogada (`gameId` + `playId` + `nflId`).

| Coluna                   | Tipo    | Significado |
|--------------------------|---------|-------------|
| `gameId`                 | num     | Identificador do jogo. |
| `playId`                 | num     | Identificador da jogada. |
| `nflId`                  | num     | Identificador do jogador. |
| `pff_role`               | texto   | Papel do jogador na jogada (ver abaixo). |
| `pff_positionLinedUp`    | texto   | Posição em que o jogador estava alinhado no snap (ex.: QB, TE-L, RT). |
| `pff_hit`                | binário | (Defensor) 1 se creditado com um *hit* no QB. |
| `pff_hurry`              | binário | (Defensor) 1 se creditado com um *hurry* (pressão). |
| `pff_sack`               | binário | (Defensor) 1 se creditado com um *sack*. |
| `pff_beatenByDefender`   | binário | (Bloqueador ofensivo) 1 se foi superado por um defensor, mas sem ser responsabilizado por hit/hurry/sack. |
| `pff_hitAllowed`         | binário | (Bloqueador ofensivo) 1 se responsável por um hit no QB. |
| `pff_hurryAllowed`       | binário | (Bloqueador ofensivo) 1 se responsável por um hurry no QB. |
| `pff_sackAllowed`        | binário | (Bloqueador ofensivo) 1 se responsável por um sack no QB. |
| `pff_nflIdBlockedPlayer` | num     | (Bloqueador ofensivo) `nflId` do primeiro defensor bloqueado. |
| `pff_blockType`          | texto   | Tipo de bloqueio executado (ver abaixo). |
| `pff_backFieldBlock`     | binário | (Bloqueador ofensivo) 1 se o bloqueio ocorreu no backfield ofensivo. |

> Valores `NA` são normais: muitos campos só se aplicam a defensores OU a bloqueadores ofensivos, então ficam vazios para os demais papéis.

**Valores de `pff_role`:**
- `Coverage`: defensor em cobertura (man ou zona).
- `Pass`: atacante identificado como o passador.
- `Pass block`: atacante bloqueando um defensor para proteger o QB.
- `Pass route`: atacante correndo rota (não é passador nem bloqueador).
- `Pass rush`: defensor com intenção inicial de pressionar o passador.

**Valores de `pff_blockType`:**
- `BH`: Backfield Help — ajuda em bloqueio a partir do backfield.
- `CH`: Chip Block — chip em um pass rusher antes de sair para a rota.
- `CL`: Second Level — bloqueio no segundo nível (≥ 2 jardas além da linha de scrimmage).
- `NB`: No Block — não executa bloqueio, apenas segue seu caminho/pass set.
- `PA`: Play Action Pass Protection — protege vendendo o play action.
- `PP`: Pass Protection — bloqueio padrão de proteção de passe (inline).
- `PR`: Pocket Roll Block — bloqueio em "rolling pocket" acompanhando o rollout do QB.
- `PT`: Post Block — segura o defensor para outro bloqueador, sem engajar totalmente.
- `PU`: Backfield Pickup — pickup de proteção por jogador do backfield.
- `SR`: Set & Release — arma a proteção e depois libera (ex.: telas / hold ups).
- `SW`: Switch Block — passa (ou tenta passar) o defensor a outro bloqueador (stunts).
- `UP`: Pull Pass Protection — bloqueador que "pulla" em proteção a partir de alinhamento inline.

---

## 5. tracking/tracking_[gameId].csv — dados de rastreamento

Um arquivo por jogo (122 arquivos). Cada linha é a posição de **um jogador (ou a bola) em um frame**. A frequência é de 10 frames por segundo (10 Hz).

| Coluna          | Tipo   | Significado |
|-----------------|--------|-------------|
| `gameId`        | num    | Identificador do jogo. |
| `playId`        | num    | Identificador da jogada. |
| `nflId`         | num    | Identificador do jogador. **`NA` = a linha é a bola.** |
| `frameId`       | num    | Número do frame dentro da jogada, começando em 1. |
| `time`          | hora   | Timestamp do frame (`yyyy-mm-ddThh:mm:ssZ`, UTC). |
| `jerseyNumber`  | num    | Número da camisa do jogador. |
| `team`          | texto  | Sigla do time do jogador; valor `football` nas linhas da bola. |
| `playDirection` | texto  | Direção em que o ataque avança (`left` ou `right`). |
| `x`             | num    | Posição no eixo longo do campo, 0–120 jardas (inclui as end zones). |
| `y`             | num    | Posição no eixo curto do campo, 0–53.3 jardas (largura). |
| `s`             | num    | Velocidade em jardas/segundo. |
| `a`             | num    | Aceleração em jardas/segundo². |
| `dis`           | num    | Distância percorrida desde o frame anterior, em jardas. |
| `o`             | num    | Orientação do jogador (para onde o corpo aponta), 0–360 graus. |
| `dir`           | num    | Ângulo da direção do movimento, 0–360 graus. |
| `event`         | texto  | Evento marcado no frame (ver abaixo); `None` quando não há evento. |

**Sistema de coordenadas do campo:** `x` vai de 0 a 120 (as duas end zones ocupam de 0–10 e 110–120); `y` vai de 0 a 53.3 (largura do campo). `o` (orientação) e `dir` (direção do movimento) são independentes: `o` indica para onde o jogador está virado e `dir` para onde ele está se deslocando.

**Exemplos de `event`** (não exaustivo, os mais comuns no dataset):
`None`, `ball_snap`, `pass_forward`, `autoevent_passforward`, `autoevent_ballsnap`, `play_action`, `line_set`, `pass_arrived`, `autoevent_passinterrupted`, `run`, `qb_sack`, `pass_outcome_incomplete`, `pass_outcome_caught`, `man_in_motion`, `fumble`, `fumble_offense_recovered`.
(Eventos prefixados com `autoevent_` são detectados automaticamente pelo algoritmo, e não anotados manualmente.)

---

## Resumo de contagens

| Item                  | Quantidade |
|-----------------------|------------|
| Jogos (games)         | 122        |
| Jogadores (players)   | 1.679      |
| Jogadas (plays)       | 8.557      |
| Arquivos de tracking  | 122 (1 por jogo) |
| Temporada / Semanas   | 2021, semanas 1–8 |

*Fonte primária das descrições de colunas: `README.md` do repositório (documentação oficial do Big Data Bowl / PFF). Contagens e valores enumerados verificados diretamente nos arquivos CSV.*
