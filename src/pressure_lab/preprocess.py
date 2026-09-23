"""NFL Pressure Lab — pipeline de pré-processamento (Fase 1).

Transforma os CSVs originais do NFL Big Data Bowl 2023 em um JSON leve por
jogada, no esquema definido em .kiro/specs/nfl-pressure-lab/design.md (Seção 6).

Princípios (herdados de requirements.md, P1–P5):
- P1: mantém em blocos separados a aproximação geométrica, a pressão PFF e o
  resultado da jogada. NUNCA os funde.
- P3: a ÚNICA métrica derivada é a distância euclidiana (fórmula documentada).
- P4: valores ausentes/NA viram ``None`` (nunca 0 silencioso).
- P5: a distância é rotulada "aproximação geométrica", nunca "pressão".

Usa apenas a biblioteca padrão do Python (RNF2).
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
from typing import Any, Dict, List, Optional, Tuple

# ----------------------------------------------------------------------------
# Constantes / configuração
# ----------------------------------------------------------------------------

# Caminho padrão do dataset para desenvolvimento local (relativo à raiz do
# projeto nfl-pressure-lab). Pode ser sobrescrito via CLI (--data-dir).
DEFAULT_DATA_DIR = "../nfl-big-data-bowl-regional-event-data/data"

# Valores que representam ausência de dado nos CSVs originais.
_NA_VALUES = {"", "NA", "na", "N/A", "nan", "None"}

# Papéis PFF relevantes (pff_role).
ROLE_QB = "Pass"
ROLE_PASS_RUSH = "Pass Rush"

# Eventos de tracking (coluna ``event``).
SNAP_ANNOTATED = "ball_snap"
SNAP_AUTO = "autoevent_ballsnap"
THROW_ANNOTATED = "pass_forward"
THROW_AUTO = "autoevent_passforward"
END_EVENTS = {
    "qb_sack",
    "pass_outcome_caught",
    "pass_outcome_incomplete",
    "pass_outcome_interception",
    "pass_outcome_touchdown",
    "tackle",
    "out_of_bounds",
    "fumble",
    "touchdown",
}

# Tradução de passResult (RF8.1).
PASS_RESULT_LABELS = {
    "C": "Completo",
    "I": "Incompleto",
    "S": "Sack",
    "R": "Scramble",
    "IN": "Interceptado",
}

FIELD_LENGTH = 120.0
FIELD_WIDTH = 53.3
FRAME_RATE_HZ = 10


# ----------------------------------------------------------------------------
# Utilitários de parsing (P4: NA -> None)
# ----------------------------------------------------------------------------

def _clean(value: Optional[str]) -> Optional[str]:
    """Normaliza um valor de célula: strings NA/ vazias viram ``None``."""
    if value is None:
        return None
    v = value.strip()
    return None if v in _NA_VALUES else v


def _to_int(value: Optional[str]) -> Optional[int]:
    v = _clean(value)
    if v is None:
        return None
    try:
        return int(float(v))
    except ValueError:
        return None


def _to_float(value: Optional[str]) -> Optional[float]:
    v = _clean(value)
    if v is None:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _to_binary(value: Optional[str]) -> Optional[int]:
    """Converte um indicador PFF: 1/0, mantendo ``None`` quando NA (P4)."""
    v = _clean(value)
    if v is None:
        return None
    try:
        return 1 if int(float(v)) == 1 else 0
    except ValueError:
        return None


# ----------------------------------------------------------------------------
# T1.1 — Contexto e resultado da jogada (plays.csv)
# ----------------------------------------------------------------------------

def load_play_context(data_dir: str, game_id: int, play_id: int) -> Dict[str, Any]:
    """Lê ``plays.csv`` e retorna os blocos ``context`` e ``result``.

    Levanta ``KeyError`` se a jogada não existir. Aplica P4 (NA -> None).
    """
    path = os.path.join(data_dir, "plays.csv")
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if _to_int(row["gameId"]) == game_id and _to_int(row["playId"]) == play_id:
                pass_result = _clean(row.get("passResult"))
                context = {
                    "possessionTeam": _clean(row.get("possessionTeam")),
                    "defensiveTeam": _clean(row.get("defensiveTeam")),
                    "quarter": _to_int(row.get("quarter")),
                    "down": _to_int(row.get("down")),
                    "yardsToGo": _to_int(row.get("yardsToGo")),
                    "yardlineSide": _clean(row.get("yardlineSide")),
                    "yardlineNumber": _to_int(row.get("yardlineNumber")),
                    "absoluteYardlineNumber": _to_int(row.get("absoluteYardlineNumber")),
                    "offenseFormation": _clean(row.get("offenseFormation")),
                    "personnelO": _clean(row.get("personnelO")),
                    "personnelD": _clean(row.get("personnelD")),
                    "defendersInBox": _to_int(row.get("defendersInBox")),
                    "dropBackType": _clean(row.get("dropBackType")),
                    "pff_playAction": _to_binary(row.get("pff_playAction")),
                    "pff_passCoverage": _clean(row.get("pff_passCoverage")),
                    "pff_passCoverageType": _clean(row.get("pff_passCoverageType")),
                    "playDescription": _clean(row.get("playDescription")),
                }
                result = {
                    "passResult": pass_result,
                    "passResultLabel": PASS_RESULT_LABELS.get(pass_result) if pass_result else None,
                    "playResult": _to_int(row.get("playResult")),
                    "prePenaltyPlayResult": _to_int(row.get("prePenaltyPlayResult")),
                    "penaltyYards": _to_int(row.get("penaltyYards")),
                }
                return {"context": context, "result": result}
    raise KeyError(f"Jogada não encontrada em plays.csv: game={game_id} play={play_id}")


# ----------------------------------------------------------------------------
# T1.2 — Identificação de QB e pass rushers (pffScoutingData.csv)
# ----------------------------------------------------------------------------

def load_pff_roles(
    data_dir: str, game_id: int, play_id: int
) -> Dict[str, Any]:
    """Extrai QB, pass rushers e indicadores de pressão PFF por jogador.

    Retorna dict com:
      - ``qb_nflId``: nflId do único jogador com pff_role == "Pass" (ou None)
      - ``rusher_nflIds``: lista de nflId com pff_role == "Pass Rush"
      - ``pff_by_player``: nflId -> {role, positionLinedUp, hit, hurry, sack}

    NÃO infere papéis por posição/movimento — usa somente pff_role (design §3).
    """
    path = os.path.join(data_dir, "pffScoutingData.csv")
    qb_nflid: Optional[int] = None
    qb_candidates: List[int] = []
    rushers: List[int] = []
    by_player: Dict[int, Dict[str, Any]] = {}

    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if _to_int(row["gameId"]) != game_id or _to_int(row["playId"]) != play_id:
                continue
            nflid = _to_int(row.get("nflId"))
            if nflid is None:
                continue
            role = _clean(row.get("pff_role"))
            by_player[nflid] = {
                "pffRole": role,
                "pffPositionLinedUp": _clean(row.get("pff_positionLinedUp")),
                "pffPressure": {
                    "hit": _to_binary(row.get("pff_hit")),
                    "hurry": _to_binary(row.get("pff_hurry")),
                    "sack": _to_binary(row.get("pff_sack")),
                },
            }
            if role == ROLE_QB:
                qb_candidates.append(nflid)
            elif role == ROLE_PASS_RUSH:
                rushers.append(nflid)

    if len(qb_candidates) == 1:
        qb_nflid = qb_candidates[0]
    elif len(qb_candidates) > 1:
        # Verificado em analise-inicial: exatamente 1 QB por jogada. Se houver
        # divergência, registramos e usamos o primeiro, sem inventar dado.
        qb_nflid = qb_candidates[0]

    return {
        "qb_nflId": qb_nflid,
        "qb_candidate_count": len(qb_candidates),
        "rusher_nflIds": rushers,
        "pff_by_player": by_player,
    }


# ----------------------------------------------------------------------------
# T1.3 — Enriquecimento com players.csv
# ----------------------------------------------------------------------------

def load_players(data_dir: str) -> Dict[int, Dict[str, Any]]:
    """Carrega players.csv em um índice nflId -> {displayName, position}."""
    path = os.path.join(data_dir, "players.csv")
    index: Dict[int, Dict[str, Any]] = {}
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            nflid = _to_int(row.get("nflId"))
            if nflid is None:
                continue
            index[nflid] = {
                "displayName": _clean(row.get("displayName")),
                "position": _clean(row.get("officialPosition")),
            }
    return index


# ----------------------------------------------------------------------------
# T1.4 — Extração e reorganização do tracking por frame
# ----------------------------------------------------------------------------

def load_tracking_frames(
    data_dir: str, game_id: int, play_id: int
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Lê tracking_[gameId].csv (filtrando playId) e organiza por frame.

    Retorna (frames, tracking_meta):
      - frames: lista ordenada por frameId; cada item tem
        {frameId, event, ball:{x,y}|None, positions:{nflId:{x,y,s,dir,o}}}
      - tracking_meta: {playDirection, jersey_by_player, teams_by_player,
                        frameCount, warnings}
    """
    path = os.path.join(data_dir, f"tracking_{game_id}.csv")
    if not os.path.exists(path):
        # arquivos de tracking ficam em subpasta tracking/
        path = os.path.join(data_dir, "tracking", f"tracking_{game_id}.csv")

    frames_map: Dict[int, Dict[str, Any]] = {}
    jersey_by_player: Dict[int, Optional[int]] = {}
    team_by_player: Dict[int, Optional[str]] = {}
    play_direction: Optional[str] = None
    warnings: List[str] = []

    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if _to_int(row["playId"]) != play_id:
                continue
            frame_id = _to_int(row.get("frameId"))
            if frame_id is None:
                continue
            if play_direction is None:
                play_direction = _clean(row.get("playDirection"))

            frame = frames_map.setdefault(
                frame_id,
                {"frameId": frame_id, "event": None, "ball": None, "positions": {}},
            )
            event = _clean(row.get("event"))
            if event and event.lower() != "none":
                frame["event"] = event

            x = _to_float(row.get("x"))
            y = _to_float(row.get("y"))
            team = _clean(row.get("team"))
            nflid = _to_int(row.get("nflId"))

            if team == "football" or nflid is None:
                # Linha da bola (P4: só grava se houver posição).
                if x is not None and y is not None:
                    frame["ball"] = {"x": x, "y": y}
                continue

            jersey_by_player[nflid] = _to_int(row.get("jerseyNumber"))
            team_by_player[nflid] = team
            frame["positions"][str(nflid)] = {
                "x": x,
                "y": y,
                "s": _to_float(row.get("s")),
                "dir": _to_float(row.get("dir")),
                "o": _to_float(row.get("o")),
            }

    if not frames_map:
        raise KeyError(
            f"Tracking não encontrado para game={game_id} play={play_id} em {path}"
        )

    ordered_ids = sorted(frames_map)
    # Verifica continuidade dos frameId (design §5).
    expected = list(range(ordered_ids[0], ordered_ids[-1] + 1))
    if ordered_ids != expected:
        warnings.append(
            f"frameId descontínuo: {len(ordered_ids)} frames, "
            f"intervalo {ordered_ids[0]}..{ordered_ids[-1]}"
        )

    frames = [frames_map[i] for i in ordered_ids]
    meta = {
        "playDirection": play_direction,
        "jersey_by_player": jersey_by_player,
        "team_by_player": team_by_player,
        "frameCount": len(frames),
        "warnings": warnings,
    }
    return frames, meta


# ----------------------------------------------------------------------------
# T1.5 — Detecção de eventos-chave (snap / lançamento / fim)
# ----------------------------------------------------------------------------

def detect_events(frames: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Detecta snap, lançamento e fim, priorizando o evento anotado.

    Cada evento é {frame, source: 'annotated'|'autoevent'} ou None (P4).
    """
    def _first(names: set) -> Optional[Dict[str, Any]]:
        for fr in frames:
            if fr["event"] in names:
                return fr["frameId"]
        return None

    snap_annotated = _first({SNAP_ANNOTATED})
    snap_auto = _first({SNAP_AUTO})
    throw_annotated = _first({THROW_ANNOTATED})
    throw_auto = _first({THROW_AUTO})

    snap = None
    if snap_annotated is not None:
        snap = {"frame": snap_annotated, "source": "annotated"}
    elif snap_auto is not None:
        snap = {"frame": snap_auto, "source": "autoevent"}

    throw = None
    if throw_annotated is not None:
        throw = {"frame": throw_annotated, "source": "annotated"}
    elif throw_auto is not None:
        throw = {"frame": throw_auto, "source": "autoevent"}

    end = None
    for fr in frames:
        if fr["event"] in END_EVENTS:
            end = {"frame": fr["frameId"], "type": fr["event"], "source": "annotated"}
            break

    return {"snap": snap, "throw": throw, "end": end}


# ----------------------------------------------------------------------------
# T1.6 — Distância geométrica QB <-> pass rusher mais próximo (por frame)
# ----------------------------------------------------------------------------

def euclidean(x1: float, y1: float, x2: float, y2: float) -> float:
    """Distância euclidiana em jardas: sqrt((x1-x2)^2 + (y1-y2)^2)."""
    return math.hypot(x1 - x2, y1 - y2)


def compute_min_distances(
    frames: List[Dict[str, Any]], qb_nflid: Optional[int], rusher_nflids: List[int]
) -> None:
    """Anexa a cada frame ``geometric_min_distance_yd`` e ``closest_rusher_nflId``.

    Considera SOMENTE os pass rushers (requisito analítico, RF6.2 / P5).
    Se o QB ou todos os rushers não tiverem posição no frame -> None (P4).
    Rótulo semântico: "aproximação geométrica", nunca "pressão" (P5).
    """
    qb_key = str(qb_nflid) if qb_nflid is not None else None
    rusher_keys = [str(r) for r in rusher_nflids]

    for fr in frames:
        best: Optional[float] = None
        best_rusher: Optional[int] = None
        qb_pos = fr["positions"].get(qb_key) if qb_key else None

        if qb_pos and qb_pos["x"] is not None and qb_pos["y"] is not None:
            for rk in rusher_keys:
                rp = fr["positions"].get(rk)
                if rp and rp["x"] is not None and rp["y"] is not None:
                    d = euclidean(qb_pos["x"], qb_pos["y"], rp["x"], rp["y"])
                    if best is None or d < best:
                        best = d
                        best_rusher = int(rk)

        fr["geometric_min_distance_yd"] = round(best, 2) if best is not None else None
        fr["closest_rusher_nflId"] = best_rusher


# ----------------------------------------------------------------------------
# Montagem do documento da jogada
# ----------------------------------------------------------------------------

def build_play_document(
    data_dir: str, game_id: int, play_id: int, players_index: Dict[int, Dict[str, Any]]
) -> Dict[str, Any]:
    """Monta o JSON completo de uma jogada, no esquema do design §6.2."""
    ctx = load_play_context(data_dir, game_id, play_id)
    roles = load_pff_roles(data_dir, game_id, play_id)
    frames, tmeta = load_tracking_frames(data_dir, game_id, play_id)
    events = detect_events(frames)
    compute_min_distances(frames, roles["qb_nflId"], roles["rusher_nflIds"])

    possession = ctx["context"]["possessionTeam"]
    defense = ctx["context"]["defensiveTeam"]
    qb_nflid = roles["qb_nflId"]
    rusher_set = set(roles["rusher_nflIds"])

    # Monta a lista de jogadores (T1.3): apenas quem aparece no tracking.
    players: List[Dict[str, Any]] = []
    tracked_ids = set()
    for fr in frames:
        tracked_ids.update(int(k) for k in fr["positions"].keys())

    for nflid in sorted(tracked_ids):
        pinfo = players_index.get(nflid, {})
        pff = roles["pff_by_player"].get(nflid, {})
        team = tmeta["team_by_player"].get(nflid)
        side = None
        if team is not None and possession is not None and defense is not None:
            if team == possession:
                side = "offense"
            elif team == defense:
                side = "defense"
        players.append(
            {
                "nflId": nflid,
                "displayName": pinfo.get("displayName"),
                "position": pinfo.get("position"),
                "jerseyNumber": tmeta["jersey_by_player"].get(nflid),
                "team": team,
                "side": side,
                "pffRole": pff.get("pffRole"),
                "pffPositionLinedUp": pff.get("pffPositionLinedUp"),
                "isQB": nflid == qb_nflid,
                "isPassRusher": nflid in rusher_set,
                "pffPressure": pff.get(
                    "pffPressure", {"hit": None, "hurry": None, "sack": None}
                ),
            }
        )

    # Resumo de pressão PFF (P1: bloco separado, NÃO derivado de geometria).
    hits = sum(1 for p in players if p["pffPressure"].get("hit") == 1)
    hurries = sum(1 for p in players if p["pffPressure"].get("hurry") == 1)
    sacks = sum(1 for p in players if p["pffPressure"].get("sack") == 1)
    by_player_pressure = [
        {
            "nflId": p["nflId"],
            "displayName": p["displayName"],
            "hit": p["pffPressure"].get("hit"),
            "hurry": p["pffPressure"].get("hurry"),
            "sack": p["pffPressure"].get("sack"),
        }
        for p in players
        if 1 in (
            p["pffPressure"].get("hit"),
            p["pffPressure"].get("hurry"),
            p["pffPressure"].get("sack"),
        )
    ]

    warnings = list(tmeta["warnings"])
    if roles["qb_candidate_count"] != 1:
        warnings.append(
            f"Esperado 1 QB (pff_role=Pass), encontrado {roles['qb_candidate_count']}."
        )

    document = {
        "meta": {
            "id": f"{game_id}_{play_id}",
            "gameId": game_id,
            "playId": play_id,
            "playDirection": tmeta["playDirection"],
            "frameCount": tmeta["frameCount"],
            "frameRateHz": FRAME_RATE_HZ,
            "fieldDims": {"length": FIELD_LENGTH, "width": FIELD_WIDTH},
            "distanceMethod": (
                "Distância euclidiana em jardas entre QB e cada pass rusher "
                "(pff_role='Pass Rush'); reporta o mínimo por frame. "
                "Aproximação geométrica — NÃO é pressão."
            ),
            "warnings": warnings,
        },
        "context": ctx["context"],
        "result": ctx["result"],
        "players": players,
        "events": events,
        "frames": frames,
        "pressureSummary": {
            "note": "Contagens de avaliações PFF; NÃO derivadas de geometria.",
            "hits": hits,
            "hurries": hurries,
            "sacks": sacks,
            "byPlayer": by_player_pressure,
        },
    }
    return document


# ----------------------------------------------------------------------------
# T1.7 — Serialização + índice
# ----------------------------------------------------------------------------

def write_play_json(document: Dict[str, Any], out_dir: str) -> str:
    """Grava o JSON da jogada em <out_dir>/plays/<id>.json e retorna o caminho."""
    plays_dir = os.path.join(out_dir, "plays")
    os.makedirs(plays_dir, exist_ok=True)
    path = os.path.join(plays_dir, f"{document['meta']['id']}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(document, fh, ensure_ascii=False, indent=2, sort_keys=True)
        fh.write("\n")
    return path


def update_index(document: Dict[str, Any], out_dir: str) -> str:
    """Cria/atualiza plays_index.json de forma idempotente (T1.8)."""
    index_path = os.path.join(out_dir, "plays_index.json")
    index: Dict[str, Any] = {"datasetNote": "NFL Big Data Bowl 2023 — temporada 2021, semanas 1-8", "plays": []}
    if os.path.exists(index_path):
        try:
            with open(index_path, encoding="utf-8") as fh:
                index = json.load(fh)
        except (json.JSONDecodeError, OSError):
            pass  # recria do zero se corrompido

    meta = document["meta"]
    ctx = document["context"]
    res = document["result"]
    entry = {
        "id": meta["id"],
        "gameId": meta["gameId"],
        "playId": meta["playId"],
        "possessionTeam": ctx.get("possessionTeam"),
        "defensiveTeam": ctx.get("defensiveTeam"),
        "quarter": ctx.get("quarter"),
        "down": ctx.get("down"),
        "yardsToGo": ctx.get("yardsToGo"),
        "passResult": res.get("passResult"),
        "description": ctx.get("playDescription"),
        "file": f"plays/{meta['id']}.json",
    }

    plays = [p for p in index.get("plays", []) if p.get("id") != meta["id"]]
    plays.append(entry)
    plays.sort(key=lambda p: p["id"])
    index["plays"] = plays

    with open(index_path, "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, indent=2, sort_keys=True)
        fh.write("\n")
    return index_path


def process_play(
    data_dir: str, out_dir: str, game_id: int, play_id: int,
    players_index: Optional[Dict[int, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Processa uma jogada ponta a ponta e grava os artefatos. Retorna o documento."""
    if players_index is None:
        players_index = load_players(data_dir)
    document = build_play_document(data_dir, game_id, play_id, players_index)
    json_path = write_play_json(document, out_dir)
    index_path = update_index(document, out_dir)
    document["_paths"] = {"json": json_path, "index": index_path}
    return document


# ----------------------------------------------------------------------------
# T1.8 — CLI
# ----------------------------------------------------------------------------

def _parse_play_arg(spec: str) -> Tuple[int, int]:
    """Aceita 'gameId/playId' ou 'gameId:playId'."""
    sep = "/" if "/" in spec else ":"
    game_str, play_str = spec.split(sep, 1)
    return int(game_str), int(play_str)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Pré-processa jogadas do NFL Big Data Bowl em JSON para o Pocket Replay.",
    )
    parser.add_argument(
        "--data-dir",
        default=DEFAULT_DATA_DIR,
        help=f"Caminho do dataset (default: {DEFAULT_DATA_DIR})",
    )
    parser.add_argument(
        "--out-dir",
        default="app/data",
        help="Diretório de saída dos JSONs (default: app/data)",
    )
    parser.add_argument(
        "--play",
        action="append",
        default=None,
        metavar="GAMEID/PLAYID",
        help="Jogada a processar (ex.: 2021090900/97). Pode repetir.",
    )
    args = parser.parse_args(argv)

    plays = args.play or ["2021090900/97"]

    if not os.path.isdir(args.data_dir):
        print(f"ERRO: dataset não encontrado em '{args.data_dir}'", file=sys.stderr)
        return 2

    players_index = load_players(args.data_dir)
    for spec in plays:
        game_id, play_id = _parse_play_arg(spec)
        doc = process_play(args.data_dir, args.out_dir, game_id, play_id, players_index)
        meta = doc["meta"]
        snap = doc["events"]["snap"]
        throw = doc["events"]["throw"]
        print(f"[OK] {meta['id']}: {meta['frameCount']} frames | "
              f"QB={next((p['nflId'] for p in doc['players'] if p['isQB']), None)} | "
              f"rushers={sum(1 for p in doc['players'] if p['isPassRusher'])} | "
              f"snap={snap['frame'] if snap else None} throw={throw['frame'] if throw else None}")
        print(f"       -> {doc['_paths']['json']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
