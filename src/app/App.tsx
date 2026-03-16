import { GameRoot } from '../game/GameRoot';
import { GameCanvas } from '../render/canvas';

export default function App() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <GameCanvas>
        <GameRoot />
      </GameCanvas>
    </div>
  );
}
