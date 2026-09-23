"""Testes automatizados do pipeline de pré-processamento (Fase 1).

Usa unittest (stdlib, RNF2). Cobre:
- Unidades puras: fórmula de distância, parsing NA->None, detecção de eventos.
- Integração com a jogada real 2021090900/97, validando os valores
  documentados em docs/analise-inicial.md (RNF8 — verificabilidade).

Os testes de integração são pulados automaticamente se o dataset original
não estiver disponível no caminho padrão (não falham o build sem os dados).
"""

import math
import os
import sys
import unittest

# Torna o pacote importável a partir de src/ sem instalação.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_ROOT, "src"))

from pressure_lab import preprocess as pp  # noqa: E402

DATA_DIR = os.path.join(_ROOT, pp.DEFAULT_DATA_DIR)
GAME_ID = 2021090900
PLAY_ID = 97
DATASET_AVAILABLE = os.path.isdir(DATA_DIR)


# ----------------------------------------------------------------------------
# Testes de unidade (não dependem do dataset)
# ----------------------------------------------------------------------------

class TestUnitHelpers(unittest.TestCase):
    def test_euclidean_basic(self):
        self.assertAlmostEqual(pp.euclidean(0, 0, 3, 4), 5.0)
        self.assertAlmostEqual(pp.euclidean(1, 1, 1, 1), 0.0)

    def test_euclidean_matches_manual(self):
        # QB (37.77, 24.22) e rusher a (33.0, 21.0)
        expected = math.hypot(37.77 - 33.0, 24.22 - 21.0)
        self.assertAlmostEqual(pp.euclidean(37.77, 24.22, 33.0, 21.0), expected)

    def test_na_parsing_returns_none(self):
        for na in ["", "NA", "N/A", "nan", None, "None"]:
            self.assertIsNone(pp._to_float(na))
            self.assertIsNone(pp._to_int(na))
            self.assertIsNone(pp._to_binary(na))

    def test_binary_parsing(self):
        self.assertEqual(pp._to_binary("1"), 1)
        self.assertEqual(pp._to_binary("0"), 0)
        self.assertIsNone(pp._to_binary("NA"))

    def test_numeric_parsing(self):
        self.assertEqual(pp._to_int("43"), 43)
        self.assertEqual(pp._to_int("43.0"), 43)
        self.assertAlmostEqual(pp._to_float("5.78"), 5.78)


class TestEventDetection(unittest.TestCase):
    def _frames(self, events):
        return [{"frameId": i + 1, "event": e} for i, e in enumerate(events)]

    def test_prefers_annotated_snap_over_auto(self):
        frames = self._frames([None, "autoevent_ballsnap", "ball_snap", None])
        ev = pp.detect_events(frames)
        self.assertEqual(ev["snap"], {"frame": 3, "source": "annotated"})

    def test_falls_back_to_autoevent(self):
        frames = self._frames([None, "autoevent_passforward", None])
        ev = pp.detect_events(frames)
        self.assertEqual(ev["throw"], {"frame": 2, "source": "autoevent"})

    def test_missing_event_is_none(self):
        frames = self._frames([None, "ball_snap", None])
        ev = pp.detect_events(frames)
        self.assertIsNone(ev["throw"])  # P4 — ausência explícita
        self.assertIsNone(ev["end"])


class TestComputeMinDistances(unittest.TestCase):
    def test_uses_only_rushers_and_handles_missing(self):
        frames = [
            {
                "frameId": 1,
                "positions": {
                    "1": {"x": 0.0, "y": 0.0},   # QB
                    "2": {"x": 3.0, "y": 4.0},   # rusher -> dist 5
                    "3": {"x": 1.0, "y": 0.0},   # NÃO-rusher (mais perto, deve ser ignorado)
                },
            },
            {
                "frameId": 2,
                "positions": {"2": {"x": 3.0, "y": 4.0}},  # QB ausente -> None
            },
        ]
        pp.compute_min_distances(frames, qb_nflid=1, rusher_nflids=[2])
        # Frame 1: só o rusher 2 conta (dist 5), ignora o não-rusher 3.
        self.assertEqual(frames[0]["geometric_min_distance_yd"], 5.0)
        self.assertEqual(frames[0]["closest_rusher_nflId"], 2)
        # Frame 2: QB sem posição -> None (P4).
        self.assertIsNone(frames[1]["geometric_min_distance_yd"])
        self.assertIsNone(frames[1]["closest_rusher_nflId"])


# ----------------------------------------------------------------------------
# Testes de integração (dependem do dataset original)
# ----------------------------------------------------------------------------

@unittest.skipUnless(DATASET_AVAILABLE, f"dataset ausente em {DATA_DIR}")
class TestIntegrationRealPlay(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.players = pp.load_players(DATA_DIR)
        cls.doc = pp.build_play_document(DATA_DIR, GAME_ID, PLAY_ID, cls.players)

    def test_qb_identified(self):
        qbs = [p for p in self.doc["players"] if p["isQB"]]
        self.assertEqual(len(qbs), 1)
        self.assertEqual(qbs[0]["nflId"], 25511)  # Tom Brady
        self.assertEqual(qbs[0]["displayName"], "Tom Brady")

    def test_five_pass_rushers(self):
        rushers = sorted(p["nflId"] for p in self.doc["players"] if p["isPassRusher"])
        self.assertEqual(rushers, [41263, 42403, 44955, 53441, 53504])

    def test_frame_count(self):
        self.assertEqual(self.doc["meta"]["frameCount"], 43)

    def test_events_snap_and_throw(self):
        self.assertEqual(self.doc["events"]["snap"], {"frame": 6, "source": "annotated"})
        self.assertEqual(self.doc["events"]["throw"], {"frame": 40, "source": "annotated"})

    def test_distance_at_snap_matches_doc(self):
        fr = next(f for f in self.doc["frames"] if f["frameId"] == 6)
        # docs/analise-inicial.md: 5,78 jardas no snap
        self.assertAlmostEqual(fr["geometric_min_distance_yd"], 5.78, places=2)
        self.assertEqual(fr["closest_rusher_nflId"], 44955)

    def test_distance_at_throw_matches_doc(self):
        fr = next(f for f in self.doc["frames"] if f["frameId"] == 40)
        # docs/analise-inicial.md: 1,79 jarda no lançamento
        self.assertAlmostEqual(fr["geometric_min_distance_yd"], 1.79, places=2)
        self.assertEqual(fr["closest_rusher_nflId"], 53504)

    def test_pass_result(self):
        self.assertEqual(self.doc["result"]["passResult"], "I")
        self.assertEqual(self.doc["result"]["passResultLabel"], "Incompleto")

    def test_three_layers_are_separate(self):
        # P1: geometria, pressão PFF e resultado ficam em blocos distintos.
        self.assertIn("frames", self.doc)              # aproximação geométrica
        self.assertIn("pressureSummary", self.doc)     # pressão PFF
        self.assertIn("result", self.doc)              # resultado
        self.assertIn("note", self.doc["pressureSummary"])

    def test_distance_is_reproducible_from_coordinates(self):
        # RNF8: recomputar d a partir das posições deve reproduzir o valor salvo.
        qb_id = "25511"
        for fr in self.doc["frames"]:
            saved = fr["geometric_min_distance_yd"]
            qb = fr["positions"].get(qb_id)
            if saved is None or qb is None:
                continue
            rusher = fr["positions"][str(fr["closest_rusher_nflId"])]
            recomputed = round(pp.euclidean(qb["x"], qb["y"], rusher["x"], rusher["y"]), 2)
            self.assertAlmostEqual(saved, recomputed, places=2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
