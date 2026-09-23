<div align="center">

# NFL Pressure Lab

### Race Against Time | Análise Tática da Pressão Defensiva

Projeto desenvolvido para o Hackathon NFL Big Data Bowl RJ (AWS, NFL e Estácio).

<br />

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![SVG](https://img.shields.io/badge/SVG-FFB13B?style=for-the-badge&logo=svg&logoColor=black)
![JSON](https://img.shields.io/badge/JSON-000000?style=for-the-badge&logo=json&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)

<br />

Demonstração online: https://nayanearaujo.github.io/nfl-pressure-lab/app/index.html

</div>

---

## Apresentação

O NFL Pressure Lab é uma aplicação web de engenharia de dados e visualização esportiva que reproduz a movimentação real de jogadores da NFL e analisa a aproximação entre o quarterback e os defensores encarregados do pass rush.

A pergunta central do projeto é: como a movimentação dos defensores influencia o espaço e o tempo disponíveis para o quarterback executar uma jogada.

A funcionalidade central é o Pocket Replay 2D, uma visão superior do campo que reproduz a jogada quadro a quadro (frame a frame) a partir de dados de rastreamento a 10 Hz. A interface destaca os pass rushers, desenha a linha entre o quarterback e o pass rusher mais próximo e exibe a distância geométrica sincronizada com o quadro atual.

O projeto separa de forma explícita três camadas de informação e não as combina:

1. Aproximação geométrica: distância euclidiana calculada a partir das coordenadas reais (x, y).
2. Pressão registrada pela PFF: indicadores de hit, hurry e sack, avaliados pela Pro Football Focus.
3. Resultado da jogada: resultado do passe e jardas obtidas.

A aproximação geométrica não é apresentada como medida oficial de pressão, e nenhuma relação de causalidade é afirmada.

## Status do projeto

A aplicação está funcional. Os componentes abaixo estão concluídos.

| Componente | Situação |
| :--- | :--- |
| Referência do dataset | Concluído |
| Análise de viabilidade | Concluído |
| Especificação técnica | Concluído |
| Estrutura do projeto | Concluído |
| Pré-processamento Python | Concluído |
| Interface web Pocket Replay 2D | Concluído |
| Modo Pocket Focus | Concluído |
| Gráfico temporal sincronizado | Concluído |
| Testes automatizados | 18 aprovados |

## Demonstração visual

Visualizações estáticas da jogada demonstrativa 2021090900 / 97 (TB x DAL). São todas a mesma jogada, em recortes e gráficos diferentes. Na aplicação, estas imagens formam a galeria "Visualizações complementares", com a explicação completa exibida ao ampliar cada imagem.

Full field

- O que mostra: as posições reais dos jogadores em um frame da jogada, no campo completo.
- Como interpretar: as cores identificam funções (amarelo é o quarterback, azul é o ataque, laranja é a defesa, vermelho são os pass rushers) e o pass rusher mais próximo recebe um contorno tracejado. A distância exibida é calculada a partir das coordenadas dos jogadores.
- Observação: no frame do lançamento, o rusher mais próximo está a cerca de 1.79 jarda do quarterback.

<div align="center">

![Pocket Replay no modo Full field](docs/images/pocket-replay-fullfield.png)

</div>

### Outros visuais

Pocket focus

- O que mostra: um enquadramento ampliado da região do quarterback, para facilitar a leitura da movimentação dos defensores próximos.
- Como interpretar: o contorno tracejado destaca o pass rusher mais próximo no frame mostrado. O zoom altera apenas a visualização.
- Observação: o zoom não altera as coordenadas dos jogadores nem as distâncias calculadas.

<div align="center">

![Modo Pocket focus](docs/images/pocket-replay-pocketfocus.png)

</div>

Linha do tempo da distância

- O que mostra: a evolução da distância ao longo da jogada. O eixo X é o frame e o eixo Y é a distância em jardas.
- Como interpretar: a curva representa a menor distância entre o quarterback e os pass rushers identificados em cada frame. As marcações são snap no frame 6 (cerca de 5.78 jardas) e lançamento no frame 40 (cerca de 1.79 jarda); a menor distância observada é 1.11 jarda no frame 43.
- Observação: a menor distância ocorre após o lançamento, não no momento da decisão de lançar. É uma versão estática do gráfico interativo apresentado na aplicação.

<div align="center">

![Linha do tempo da distância](docs/images/distance-timeline.png)

</div>

Posição do pass rusher mais próximo por frame

- O que mostra: a trajetória contínua do quarterback (linha amarela) e a posição do pass rusher mais próximo em cada frame.
- Como interpretar: os segmentos coloridos são interrompidos sempre que muda o identificador do defensor; portanto, não representam a trajetória contínua de um único atleta. Os marcadores indicam o snap e o lançamento.
- Observação: nesta jogada, o defensor mais próximo muda entre Carlos Watkins, Micah Parsons, Demarcus Lawrence e Osa Odighizuwa.

<div align="center">

![Posição do pass rusher mais próximo por frame](docs/images/qb-rusher-paths.png)

</div>

Cartão de resumo da jogada

- O que mostra: um resumo com três informações distintas e separadas, A aproximação geométrica calculada, B pressão registrada pela PFF, e C resultado oficial da jogada.
- Como interpretar: os 4 hurries são registros da PFF e não foram calculados a partir da distância.
- Observação: o passe foi incompleto, mas esse resultado não é atribuído à aproximação dos defensores como relação causal demonstrada.

<div align="center">

![Cartão de resumo da jogada](docs/images/play-summary-card.png)

</div>

## Resultados da jogada de demonstração

Valores extraídos diretamente do JSON processado da jogada 2021090900 / 97 (TB x DAL).

- Snap no frame 6 e lançamento no frame 40.
- Aproximação geométrica no snap (frame 6): 5.78 jardas.
- Aproximação geométrica no lançamento (frame 40): 1.79 jarda.
- Menor aproximação observada na jogada: 1.11 jarda, no frame 43, que ocorre após o lançamento.
- Pressão registrada pela PFF: 4 hurries, 0 hits, 0 sacks.
- Resultado do passe: incompleto.

Observações de leitura:

- A distância de 1.79 jarda corresponde ao momento do lançamento (frame 40). A distância de 1.11 jarda corresponde ao frame 43, posterior ao lançamento, e não representa a distância no momento da decisão de lançar.
- A menor distância ao quarterback em cada frame é calculada entre os pass rushers identificados naquele frame. O defensor mais próximo pode mudar ao longo da jogada. Nesta jogada, o defensor mais próximo é, em frames diferentes, Carlos Watkins, Micah Parsons, Demarcus Lawrence e Osa Odighizuwa.
- Estes números descrevem a aproximação geométrica e a pressão avaliada pela PFF de forma separada. Não se afirma que a aproximação dos defensores causou o passe incompleto.

## Stack tecnológica

| Tecnologia | Papel no projeto |
| :--- | :--- |
| ![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white) | Pré-processamento dos CSVs e validação automatizada dos dados. |
| ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black) | Reprodução quadro a quadro, controles e interatividade. |
| ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white) | Estrutura da interface. |
| ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white) | Apresentação, tema escuro e layout responsivo. |
| ![SVG](https://img.shields.io/badge/SVG-FFB13B?style=flat&logo=svg&logoColor=black) | Visualização do campo, jogadores, linha de aproximação e gráfico temporal. |
| ![JSON](https://img.shields.io/badge/JSON-000000?style=flat&logo=json&logoColor=white) | Armazenamento dos dados processados por jogada. |
| ![Git](https://img.shields.io/badge/Git-F05032?style=flat&logo=git&logoColor=white) | Controle de versão. |
| ![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white) | Hospedagem do repositório. |

O front-end usa JavaScript puro, sem frameworks ou dependências externas. O pré-processamento usa apenas a biblioteca padrão do Python.

## Arquitetura

A arquitetura tem duas fases desacopladas, sem back-end em tempo de execução.

```
CSVs originais (dataset NFL)
        |
        v
[ Python: pré-processamento ]  ->  JSON por jogada (leve)
        |
        v
[ Navegador: HTML + CSS + JS + SVG ]  ->  Pocket Replay 2D
```

1. Pré-processamento (Python, offline): lê os CSVs originais do dataset e gera um JSON leve por jogada, contendo frames, jogadores, eventos, distâncias pré-computadas e metadados. O caminho do dataset é configurável, com valor padrão apontando para uma pasta irmã do projeto.
2. Interface (navegador): consome apenas os JSONs processados. O campo e a movimentação são renderizados em SVG e atualizados por quadro. O navegador nunca carrega os CSVs brutos de rastreamento.

A distância entre o quarterback e o pass rusher mais próximo considera exclusivamente os defensores identificados como pass rush no scouting da PFF. O cálculo é feito no pré-processamento em Python e armazenado no JSON, de forma reproduzível a partir das coordenadas.

## Estrutura do projeto

```
nfl-pressure-lab/
├── README.md
├── .gitignore
├── src/
│   └── pressure_lab/
│       ├── __init__.py
│       └── preprocess.py          # pipeline de pré-processamento (CLI)
├── app/
│   ├── index.html                 # estrutura da interface
│   ├── css/
│   │   └── styles.css             # tema escuro e layout responsivo
│   ├── js/
│   │   ├── app.js                 # orquestração, seletor e controles
│   │   ├── field-renderer.js      # campo SVG, jogadores e enquadramento
│   │   ├── playback.js            # reprodução quadro a quadro
│   │   ├── stats-panel.js         # painel em três camadas
│   │   └── dist-chart.js          # gráfico temporal da distância
│   └── data/
│       ├── plays_index.json       # índice das jogadas disponíveis
│       └── plays/
│           └── 2021090900_97.json # dados processados de uma jogada
├── tests/
│   └── test_preprocess.py         # testes automatizados do pipeline
├── docs/
│   ├── data-reference.md          # referência das colunas do dataset
│   └── analise-inicial.md         # análise de viabilidade
└── .kiro/specs/nfl-pressure-lab/  # especificação (requirements, design, tasks)
```

## Funcionalidades

Visualização do campo

- Campo em SVG com proporção real (120 por 53.3 jardas), linhas de jarda, numeração e end zones.
- Renderização de quarterback, jogadores de ataque, jogadores de defesa, pass rushers, pass rusher mais próximo e bola, com diferenciação visual e legenda.
- Correspondência direta entre as coordenadas do rastreamento e a posição exibida.

Reprodução

- Play, pause, avançar um quadro, retroceder um quadro e slider de navegação.
- Controle de velocidade e indicador de tempo decorrido desde o snap.
- Uso exclusivo da sequência real de quadros, sem quadros intermediários gerados.

Zoom tático

- Modo Full Field, com a visão completa do campo.
- Modo Pocket Focus, que amplia a região do quarterback e acompanha sua movimentação, preservando a proporção do campo e as coordenadas reais.

Análise de aproximação

- Linha entre o quarterback e o pass rusher mais próximo.
- Distância atual apresentada em jardas, fora da região de maior concentração de jogadores, sincronizada com o quadro.
- Métrica calculada apenas com defensores identificados como pass rush.

Eventos e estatísticas

- Marcação de snap, lançamento e encerramento na linha do tempo, quando presentes no dado.
- Painel com três blocos separados: aproximação geométrica, pressão registrada pela PFF e resultado da jogada.
- Gráfico temporal em SVG com a evolução da distância e cursor sincronizado com o quadro.
- Seção de metodologia e limitações.

## Metodologia e integridade dos dados

- Identificação do quarterback e dos pass rushers a partir do arquivo de scouting da PFF, sem inferência por posição ou movimento.
- Distância euclidiana em jardas entre o quarterback e cada pass rusher, com o mínimo por quadro registrado no JSON.
- Valores ausentes são tratados de forma explícita na interface, sem substituição por zero.
- As três camadas de informação permanecem separadas em toda a interface.
- O dataset original é propriedade de terceiros e não é redistribuído neste repositório.

## Dataset

O projeto utiliza o NFL Big Data Bowl 2023 (temporada 2021, semanas 1 a 8), com dados de rastreamento a 10 Hz da NFL Next Gen Stats e dados de scouting da Pro Football Focus.

Dataset oficial: https://github.com/ThompsonJamesBliss/nfl-big-data-bowl-regional-event-data

A referência das colunas está em [docs/data-reference.md](docs/data-reference.md) e a análise de viabilidade em [docs/analise-inicial.md](docs/analise-inicial.md).

## Instalação e execução

Pré-requisitos: Python 3.9 ou superior. Não há dependências externas.

Executar a interface localmente, servindo a partir da raiz do repositório:

```bash
python3 -m http.server 8000
```

Depois, abra `http://localhost:8000/app/index.html` no navegador. Servir a partir da raiz garante que a galeria de visualizações complementares (em `docs/images/`) carregue corretamente, com os mesmos caminhos relativos usados no GitHub Pages. A aplicação já inclui o JSON de demonstração da jogada, então funciona sem processamento adicional.

Regenerar os dados de uma jogada (opcional, requer o dataset em uma pasta irmã):

```bash
PYTHONPATH=src python3 -m pressure_lab.preprocess --play 2021090900/97
```

O caminho do dataset pode ser configurado com a opção `--data-dir`.

## Testes

Os testes automatizados validam o pipeline de pré-processamento, incluindo a fórmula de distância, o tratamento de valores ausentes, a detecção de eventos e a reprodutibilidade dos valores a partir das coordenadas. A suíte atual tem 18 testes, todos aprovados.

```bash
python3 -m unittest discover -s tests
```

## Processo de desenvolvimento

O projeto foi desenvolvido para o Hackathon NFL Big Data Bowl RJ (AWS, NFL e Estácio), com apoio do Kiro, ferramenta da AWS, na estruturação das especificações, na implementação e na validação.

O trabalho foi organizado em etapas de requisitos, desenho técnico, tarefas, implementação e testes, conforme os arquivos de especificação presentes no repositório em `.kiro/specs/nfl-pressure-lab/`:

- `requirements.md`: requisitos funcionais e não funcionais.
- `design.md`: arquitetura, fluxo de dados, esquema dos JSON e estratégia de visualização.
- `tasks.md`: tarefas de implementação, com o histórico do que foi concluído.

A aplicação está publicada no GitHub Pages. O repositório é versionado com Git e hospedado no GitHub.

## Licença e créditos

Os dados de rastreamento e de scouting pertencem à NFL e à Pro Football Focus e estão sujeitos aos termos do NFL Big Data Bowl. Este repositório contém apenas o código da aplicação e um JSON de demonstração derivado de uma jogada.
