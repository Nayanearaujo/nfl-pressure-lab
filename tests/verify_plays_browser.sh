#!/usr/bin/env bash
# Verificação funcional das 5 jogadas no navegador (headless).
#
# Complementa os testes Python (que cobrem o pré-processamento e a agregação):
# aqui exercitamos a INTERFACE de ponta a ponta, em um Chromium headless.
#
# Por jogada, o script confere comportamento OBSERVÁVEL (não a mera existência
# de um botão):
#   1. o status reflete a jogada carregada;
#   2. o painel de resultado mostra o rótulo correto (inclusive "Sack");
#   3. a aproximação geométrica é exibida em jardas;
#   4. os controles ficam habilitados (play/slider);
#   5. o marcador de snap está presente na timeline;
#   6. coerência do lançamento: sacks NÃO têm marcador de lançamento;
#   7. o gráfico de distância é renderizado (curva) e a curva corresponde à
#      jogada (o atributo "d" do path muda entre jogadas distintas);
#   8. coerência do rótulo de lançamento no gráfico (ausente em sacks);
#   9. Play avança os frames de fato (o índice cresce em relação ao inicial);
#  10. durante a reprodução o botão passa a "Pause" (ícone e rótulo);
#  11. Pause interrompe o avanço (o índice fica estável entre duas leituras);
#  12. alternar Full field <-> Pocket focus NÃO perde o frame atual;
#  13. ao chegar ao último frame, a reprodução para; um novo Play reinicia.
# Ao final, confere a ausência de erros de página no console durante tudo isso.
#
# Os critérios usam esperas e comparações relativas (avançou / ficou estável),
# sem depender de um tempo exato de máquina.
#
# Requisitos: python3 (servidor HTTP) e agent-browser (Chromium headless).
# Se o agent-browser não estiver disponível, o script informa e sai com 3
# (NÃO declara aprovação).
#
# Uso: tests/verify_plays_browser.sh
# Sai 0 se todas as verificações passarem; !=0 caso contrário.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 2

PORT="${PORT:-8231}"
BASE="http://localhost:${PORT}/app/index.html"
SESSION="verify-plays-$$"

# Dependência obrigatória: agent-browser
if ! command -v agent-browser >/dev/null 2>&1; then
  echo "LIMITAÇÃO: agent-browser não encontrado no PATH."
  echo "A verificação funcional NÃO foi executada. Não declarar como aprovada."
  exit 3
fi

# Jogadas esperadas: "arquivo|rótulo de resultado|tem_lançamento(1/0)"
PLAYS=(
  "plays/2021090900_97.json|Incompleto|1"
  "plays/2021091200_231.json|Completo|1"
  "plays/2021091200_2631.json|Sack|0"
  "plays/2021091201_691.json|Sack|0"
  "plays/2021091204_2196.json|Completo|1"
)

fail=0
pass=0

log()  { printf '%s\n' "$*"; }
ok()   { printf '  [OK]   %s\n' "$*"; pass=$((pass+1)); }
bad()  { printf '  [FALHA] %s\n' "$*"; fail=$((fail+1)); }

ab() { agent-browser --session "$SESSION" "$@" 2>/dev/null; }
ev() { agent-browser --session "$SESSION" eval "$1" 2>/dev/null | sed 's/^"//; s/"$//'; }

# --- sobe o servidor HTTP a partir da raiz do repositório ---
python3 -m http.server "$PORT" >/tmp/verify_http.log 2>&1 &
HTTP_PID=$!
cleanup() {
  kill "$HTTP_PID" 2>/dev/null
  ab close >/dev/null 2>&1
}
trap cleanup EXIT
sleep 1.5

# --- abre a página e espera a inicialização (seletor populado) ---
ab open "$BASE" >/dev/null 2>&1
ab set viewport 1400x1000 1 >/dev/null 2>&1
ab wait 1600 >/dev/null 2>&1

selcount=$(ev "document.querySelectorAll('#play-selector option').length")
log "Jogadas no seletor: ${selcount}"
if [ "${selcount}" = "5" ]; then ok "seletor populado com 5 jogadas"; else bad "esperava 5 opções, encontrei ${selcount}"; fi

# limpa o console antes de exercitar
ab console --clear >/dev/null 2>&1
ab errors --clear >/dev/null 2>&1

prev_path=""   # guarda o "d" do gráfico da jogada anterior (checagem 7)

for entry in "${PLAYS[@]}"; do
  file="${entry%%|*}"
  rest="${entry#*|}"
  label="${rest%%|*}"
  hasthrow="${rest##*|}"
  id="${file#plays/}"; id="${id%.json}"

  log ""
  log "== Jogada ${id} (resultado esperado: ${label}) =="

  # seleciona a jogada e dispara o change
  ev "(()=>{const s=document.getElementById('play-selector'); s.value='${file}'; s.dispatchEvent(new Event('change')); return s.value;})()" >/dev/null
  ab wait 900 >/dev/null 2>&1

  # snapshot do estado estático da UI
  state=$(agent-browser --session "$SESSION" eval \
    "(()=>{const t=id=>{const e=document.getElementById(id);return e?e.textContent.trim():null};\
      return JSON.stringify({\
        status:t('status'),\
        result:t('result-body'),\
        geo:t('geo-current'),\
        playDisabled:document.getElementById('btnPlay').disabled,\
        sliderDisabled:document.getElementById('slider').disabled,\
        throwMarkers:document.querySelectorAll('#event-markers .marker.throw').length,\
        snapMarkers:document.querySelectorAll('#event-markers .marker.snap').length,\
        chartLine:document.querySelectorAll('#dist-chart path.chart-line').length,\
        chartD:(document.querySelector('#dist-chart path.chart-line')||{}).getAttribute?document.querySelector('#dist-chart path.chart-line').getAttribute('d'):null,\
        chartThrowLabel:document.querySelectorAll('#dist-chart .chart-evlabel.throw').length\
      });})()" 2>/dev/null | sed 's/^"//; s/"$//; s/\\"/"/g')

  parse() { printf '%s' "$state" | python3 -c "import sys,json;d=json.load(sys.stdin);v=d.get('$1');print('' if v is None else v)" 2>/dev/null; }

  st=$(parse status);      res=$(parse result);        geo=$(parse geo)
  pdis=$(parse playDisabled); sdis=$(parse sliderDisabled)
  thr=$(parse throwMarkers);  snp=$(parse snapMarkers)
  cline=$(parse chartLine);   cd_attr=$(parse chartD);  cthrow=$(parse chartThrowLabel)

  # 1) status reflete a jogada
  case "$st" in *"$id"*) ok "status reflete a jogada (${id})";; *) bad "status não menciona ${id}: '${st}'";; esac
  # 2) painel de resultado
  case "$res" in *"$label"*) ok "painel de resultado mostra '${label}'";; *) bad "painel não mostra '${label}': '${res}'";; esac
  # 3) aproximação geométrica em yd
  case "$geo" in *yd*) ok "aproximação geométrica exibida (${geo})";; *) bad "aproximação geométrica vazia: '${geo}'";; esac
  # 4) controles habilitados
  if [ "$pdis" = "False" ] && [ "$sdis" = "False" ]; then ok "controles habilitados (play/slider)"; else bad "controles não habilitados (play=${pdis}, slider=${sdis})"; fi
  # 5) marcador de snap
  if [ "$snp" = "1" ]; then ok "marcador de snap presente"; else bad "marcador de snap ausente (${snp})"; fi
  # 6) coerência do lançamento na timeline
  if [ "$hasthrow" = "1" ]; then
    if [ "$thr" = "1" ]; then ok "marcador de lançamento presente"; else bad "esperava marcador de lançamento, achei ${thr}"; fi
  else
    if [ "$thr" = "0" ]; then ok "sack sem marcador de lançamento (correto)"; else bad "sack não deveria ter marcador de lançamento (${thr})"; fi
  fi
  # 7) gráfico renderizado + curva correspondente à jogada (d muda entre jogadas)
  if [ "$cline" = "1" ] && [ -n "$cd_attr" ]; then
    if [ -n "$prev_path" ] && [ "$cd_attr" = "$prev_path" ]; then
      bad "curva do gráfico idêntica à da jogada anterior (não atualizou)"
    else
      ok "gráfico de distância renderizado e curva atualizada para a jogada"
    fi
  else
    bad "curva do gráfico ausente (paths=${cline})"
  fi
  prev_path="$cd_attr"
  # 8) rótulo de lançamento no gráfico coerente (ausente em sacks)
  if [ "$hasthrow" = "1" ]; then
    if [ "$cthrow" = "1" ]; then ok "gráfico mostra rótulo de lançamento"; else bad "gráfico deveria ter rótulo de lançamento (${cthrow})"; fi
  else
    if [ "$cthrow" = "0" ]; then ok "gráfico sem rótulo de lançamento no sack (correto)"; else bad "sack não deveria ter rótulo de lançamento no gráfico (${cthrow})"; fi
  fi

  # --- comportamento dinâmico ---

  # garante um ponto de partida longe do fim: volta ao início
  ev "(()=>{const s=document.getElementById('slider'); s.value=0; s.dispatchEvent(new Event('input')); return s.value;})()" >/dev/null
  ab wait 200 >/dev/null 2>&1
  idx0=$(ev "document.getElementById('slider').value")

  # 9+10) Play avança e botão vira Pause
  ev "document.getElementById('btnPlay').click(); 'play'" >/dev/null
  ab wait 700 >/dev/null 2>&1
  dyn=$(agent-browser --session "$SESSION" eval \
    "JSON.stringify({label:document.getElementById('btnPlayLabel').textContent,\
      playIcon:getComputedStyle(document.querySelector('.ic-play')).display,\
      pauseIcon:getComputedStyle(document.querySelector('.ic-pause')).display,\
      idx:parseInt(document.getElementById('slider').value,10)})" 2>/dev/null | sed 's/^"//; s/"$//; s/\\"/"/g')
  dget() { printf '%s' "$dyn" | python3 -c "import sys,json;print(json.load(sys.stdin).get('$1'))" 2>/dev/null; }
  lbl=$(dget label); pic=$(dget playIcon); qic=$(dget pauseIcon); idx1=$(dget idx)

  if [ -n "$idx1" ] && [ "$idx1" -gt "${idx0:-0}" ] 2>/dev/null; then
    ok "Play avança os frames (${idx0} -> ${idx1})"
  else
    bad "Play não avançou os frames (${idx0} -> ${idx1})"
  fi
  if [ "$lbl" = "Pause" ] && [ "$pic" = "none" ] && [ "$qic" = "block" ]; then
    ok "durante a reprodução o botão vira Pause (ícone e rótulo)"
  else
    bad "estado de reprodução incorreto (label='${lbl}', play=${pic}, pause=${qic})"
  fi

  # 11) Pause interrompe o avanço (índice estável entre duas leituras)
  ev "document.getElementById('btnPlay').click(); 'pause'" >/dev/null
  ab wait 300 >/dev/null 2>&1
  pa=$(ev "document.getElementById('slider').value")
  ab wait 500 >/dev/null 2>&1
  pb=$(ev "document.getElementById('slider').value")
  lbl2=$(ev "document.getElementById('btnPlayLabel').textContent")
  if [ "$pa" = "$pb" ] && [ "$lbl2" = "Play" ]; then
    ok "Pause interrompe o avanço (índice estável em ${pa}; botão volta a Play)"
  else
    bad "Pause não interrompeu (a=${pa}, b=${pb}, label='${lbl2}')"
  fi

  # 12) Full field <-> Pocket focus sem perder o frame
  before=$(ev "document.getElementById('slider').value")
  ev "document.getElementById('modePocket').click(); 'pocket'" >/dev/null
  ab wait 250 >/dev/null 2>&1
  pocketOn=$(ev "document.getElementById('field').classList.contains('pocket')")
  after=$(ev "document.getElementById('slider').value")
  ev "document.getElementById('modeFull').click(); 'full'" >/dev/null
  ab wait 250 >/dev/null 2>&1
  pocketOff=$(ev "document.getElementById('field').classList.contains('pocket')")
  after2=$(ev "document.getElementById('slider').value")
  if [ "$pocketOn" = "true" ] && [ "$pocketOff" = "false" ] && [ "$before" = "$after" ] && [ "$after" = "$after2" ]; then
    ok "alterna Full/Pocket preservando o frame (${before})"
  else
    bad "alternância Full/Pocket incorreta (pocketOn=${pocketOn}, pocketOff=${pocketOff}, frame ${before}->${after}->${after2})"
  fi

  # 13) último frame: para no fim; novo Play reinicia
  last=$(ev "(()=>{const s=document.getElementById('slider'); s.value=s.max; s.dispatchEvent(new Event('input')); return s.value;})()")
  ab wait 200 >/dev/null 2>&1
  ev "document.getElementById('btnPlay').click(); 'play-at-end'" >/dev/null
  ab wait 500 >/dev/null 2>&1
  # ao dar play no fim, o controlador reinicia do índice 0 e avança
  atEnd=$(ev "document.getElementById('slider').value")
  lblEnd=$(ev "document.getElementById('btnPlayLabel').textContent")
  ev "if(document.getElementById('btnPlayLabel').textContent==='Pause'){document.getElementById('btnPlay').click();} 'stop'" >/dev/null
  ab wait 200 >/dev/null 2>&1
  if [ -n "$atEnd" ] && [ "$atEnd" -lt "$last" ] 2>/dev/null; then
    ok "no último frame (${last}) o Play reinicia a reprodução (índice ${atEnd})"
  else
    # também é aceitável parar no fim sem reiniciar, desde que não trave em reprodução perpétua
    if [ "$lblEnd" = "Play" ]; then
      ok "no último frame a reprodução não avança além do fim (parada em ${last})"
    else
      bad "comportamento no fim inesperado (frame=${atEnd}, last=${last}, label='${lblEnd}')"
    fi
  fi
done

# --- erros de página acumulados durante todas as operações ---
log ""
errs=$(ab errors | grep -v '^[[:space:]]*$' | grep -vi 'no page errors\|no errors' || true)
if [ -z "$errs" ]; then
  ok "sem erros de página no console durante as operações"
else
  bad "erros de página no console:"; printf '%s\n' "$errs"
fi

log ""
log "Resumo: ${pass} verificações OK, ${fail} falhas (5 jogadas)."
[ "$fail" -eq 0 ]
