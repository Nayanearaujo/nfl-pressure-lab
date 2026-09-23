# NFL Pressure Lab

> Projeto para o **Hackathon NFL Big Data Bowl RJ — AWS, NFL & Estácio**.

## Objetivo da aplicação

O **NFL Pressure Lab** é uma aplicação web interativa para analisar a **pressão defensiva sobre o quarterback (QB)** usando dados reais de rastreamento (tracking) da NFL.

A pergunta central do projeto é:

> *"Como a movimentação dos defensores influencia o espaço e o tempo disponíveis para o quarterback executar uma jogada?"*

A funcionalidade central é o **Pocket Replay 2D**: um campo de futebol americano visto de cima que reproduz a movimentação dos jogadores frame a frame, destacando os *pass rushers* e a **aproximação geométrica** entre o QB e o pass rusher mais próximo.

O projeto distingue explicitamente três camadas de informação e **nunca as funde**:
1. **Aproximação geométrica** — distância calculada a partir das coordenadas `(x, y)` reais.
2. **Pressão registrada pela PFF** — indicadores `pff_hit`, `pff_hurry`, `pff_sack` (avaliação proprietária da PFF).
3. **Resultado da jogada** — `passResult` e jardas ganhas.

> Nenhuma relação de causalidade é afirmada, e aproximação geométrica **não** é tratada automaticamente como pressão efetiva.

## Dataset utilizado

Este projeto consome o dataset do **NFL Big Data Bowl 2023** (temporada 2021, semanas 1–8):
- 122 jogos, 8.557 jogadas, 1.679 jogadores.
- Dados de tracking a 10 Hz (posição, velocidade, aceleração, orientação e direção por jogador e pela bola).
- Dados de scouting da [Pro Football Focus (PFF)](https://www.pff.com/) e dados de tracking da equipe NFL Next Gen Stats.

O dataset é propriedade de terceiros e **não é redistribuído** por este repositório.

**Dataset oficial:** https://github.com/ThompsonJamesBliss/nfl-big-data-bowl-regional-event-data

Documentação detalhada das colunas e da análise de viabilidade está em [`docs/`](docs/):
- [`docs/data-reference.md`](docs/data-reference.md) — referência completa das colunas dos CSVs.
- [`docs/analise-inicial.md`](docs/analise-inicial.md) — análise inicial de viabilidade.

## Arquitetura planejada

> ⚠️ Arquitetura **planejada** — ainda não implementada.

Arquitetura em duas fases desacopladas, sem backend em runtime:

1. **Pré-processamento (Python, offline):** um script lê os CSVs originais do dataset e gera artefatos **JSON leves** — um por jogada — contendo apenas os dados necessários (frames, jogadores, eventos, distâncias pré-computadas, metadados).
2. **Interface (navegador):** HTML + CSS + JavaScript (vanilla), com o campo e a movimentação renderizados em **SVG**, atualizados por frame. O navegador consome apenas os JSONs processados — **nunca** os CSVs brutos de tracking (~826 MB).

O caminho para o dataset é **configurável** no script de pré-processamento. O padrão de desenvolvimento local aponta para:

```
../nfl-big-data-bowl-regional-event-data/data/
```

Assim, o dataset original permanece em sua pasta e **não é duplicado** neste projeto.

Detalhes completos em [`.kiro/specs/nfl-pressure-lab/design.md`](.kiro/specs/nfl-pressure-lab/design.md).

### Estrutura de diretórios

```
nfl-pressure-lab/
├── README.md
├── .gitignore
├── docs/                       # documentação (referência de dados + análise)
├── .kiro/specs/nfl-pressure-lab/   # especificação (requirements, design, tasks)
├── src/                        # código de pré-processamento em Python (a implementar)
├── app/                        # interface web (HTML/CSS/JS/SVG) (a implementar)
│   └── data/                   # JSONs processados por jogada (gerados)
├── tests/                      # testes (a implementar)
└── outputs/                    # artefatos gerados/relatórios (a implementar)
```

## Funcionalidades previstas

> ⚠️ As funcionalidades abaixo estão **previstas / especificadas**, e **ainda não foram implementadas**.

- Seleção de jogada a partir de um índice.
- Campo SVG com QB, ataque, defesa (pass rushers destacados) e bola.
- Reprodução frame a frame com play/pause, avançar, retroceder e scrub na timeline.
- Identificação dos pass rushers a partir do `pffScoutingData.csv`.
- Cálculo e exibição da aproximação geométrica entre o QB e o pass rusher mais próximo.
- Marcação dos eventos de snap, lançamento e encerramento da jogada, quando disponíveis.
- Painel de estatísticas em três camadas separadas (contexto, pressão PFF, resultado).
- Seção de metodologia e limitações.

A lista completa, com critérios de aceitação verificáveis, está em [`.kiro/specs/nfl-pressure-lab/requirements.md`](.kiro/specs/nfl-pressure-lab/requirements.md).

## Status atual do desenvolvimento

**Fase atual: organização e especificação (pré-implementação).**

| Item | Status |
|------|--------|
| Referência do dataset (`docs/data-reference.md`) | ✅ Concluído |
| Análise de viabilidade (`docs/analise-inicial.md`) | ✅ Concluído |
| Especificação — requirements / design / tasks | ✅ Concluído |
| Estrutura do projeto independente | ✅ Concluído |
| Pré-processamento Python (`src/`) | ⬜ Não iniciado |
| Interface web / Pocket Replay 2D (`app/`) | ⬜ Não iniciado |
| Testes (`tests/`) | ⬜ Não iniciado |

Nenhum código de aplicação foi implementado até o momento. O próximo passo previsto é executar as tarefas descritas em [`.kiro/specs/nfl-pressure-lab/tasks.md`](.kiro/specs/nfl-pressure-lab/tasks.md), começando pelo MVP com uma jogada real.

## Instalação e execução

> ⚠️ Instruções a serem detalhadas quando a implementação começar (ver `tasks.md`, T4.5). O projeto foi planejado para rodar localmente com passos mínimos (pré-processamento em Python + servidor estático simples).
