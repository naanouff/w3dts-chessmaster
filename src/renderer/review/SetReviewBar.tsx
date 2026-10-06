/**
 * @file SetReviewBar.tsx
 * @project w3dts
 * @author Cyril TARRIET
 * @description Room and camera controls for the engine review. Hidden during a match.
 */

import { useEffect, useState, type ReactElement } from 'react';
import {
  getChessGraphicsSettings,
  subscribeChessGraphics,
  useChessGraphicsSettings,
  type ChessGraphicsSettings,
} from '../graphics/chessGraphicsSettings';
import { getChessAmbiance, setChessAmbiance, type ChessAmbianceId } from '../host/chessAmbiance';
import {
  chessReviewFrame,
  requestChessCameraArrival,
  setChessReviewFrame,
  subscribeChessReviewFrame,
  type ChessReviewFrame,
} from '../host/chessSetReview';

const ROOMS: readonly { id: ChessAmbianceId; label: string }[] = [
  { id: 'atelier', label: 'Atelier' },
  { id: 'salon', label: 'Salon' },
  { id: 'club', label: 'Club' },
  { id: 'jardin', label: 'Jardin' },
];

/** Post passes the review can switch off one by one, to see what each one costs the image. */
const POST_PASSES: readonly { key: keyof ChessGraphicsSettings; label: string }[] = [
  { key: 'ambientOcclusion', label: 'HBAO' },
  { key: 'reflections', label: 'SSR' },
  { key: 'bloom', label: 'Bloom' },
  { key: 'antialiasing', label: 'FXAA' },
];

/**
 * Switches the staged room and the review camera. The image is the game engine.
 * @returns The review bar.
 */
export default function SetReviewBar(): ReactElement {
  const [room, setRoom] = useState<ChessAmbianceId>(getChessAmbiance());
  const [frame, setFrame] = useState<ChessReviewFrame>(chessReviewFrame());
  const [graphics, setGraphics] = useState<ChessGraphicsSettings>(getChessGraphicsSettings());

  // The review profile is applied while the host boots, after this bar first renders.
  useEffect(() => {
    setGraphics(getChessGraphicsSettings());
    return subscribeChessGraphics(setGraphics);
  }, []);

  useEffect(() => subscribeChessReviewFrame(setFrame), []);

  return (
    <div className="set-review">
      {ROOMS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={room === entry.id ? 'is-on' : undefined}
          onClick={() => {
            setChessAmbiance(entry.id);
            setRoom(entry.id);
          }}
        >
          {entry.label}
        </button>
      ))}
      <button
        type="button"
        className={frame === 'game' ? 'is-on' : undefined}
        onClick={() => {
          setChessReviewFrame('game');
          setFrame('game');
        }}
      >
        Caméra de jeu
      </button>
      <button
        type="button"
        className={frame === 'wide' ? 'is-on' : undefined}
        onClick={() => {
          setChessReviewFrame('wide');
          setFrame('wide');
        }}
      >
        Cadre
      </button>
      <button type="button" onClick={() => requestChessCameraArrival()}>
        Arrivée
      </button>
      <span className="set-review-sep" />
      {POST_PASSES.map((pass) => (
        <button
          key={pass.key}
          type="button"
          className={graphics[pass.key] ? 'is-on' : undefined}
          onClick={() => {
            const next = { ...graphics, [pass.key]: !graphics[pass.key] };
            useChessGraphicsSettings(next);
            setGraphics(next);
          }}
        >
          {pass.label}
        </button>
      ))}
      <p className="set-review-status">Revue du moteur.</p>
    </div>
  );
}
