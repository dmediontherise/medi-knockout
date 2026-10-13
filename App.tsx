import React from 'react';
import { useGameLoop } from './hooks/useGameLoop';
import Controls from './components/Controls';
import { GameCanvas } from './components/GameCanvas';
import { GameState, PlayerAction } from './types';
import { Trophy, Skull, Play, Info, AlertTriangle, RefreshCcw } from 'lucide-react';
import { soundEngine } from './utils/sound';
import { ROSTER } from './constants';
import { createFight } from './src/core/engine';
import { FightState, ActionType, OpponentActionType } from './src/core/types';

const App: React.FC = () => {
  const { 
    gameState, 
    feedbackMessage, 
    currentOpponent, 
    activeSpecial, 
    fightState, 
    handlePlayerInput, 
    releaseBlock, 
    resetGame 
  } = useGameLoop();

  // Pose preview route support via URL query parameters
  // ?pose=<opponent_id>&action=<OpponentAction>&player=<PlayerAction>
  const [posePreviewState, setPosePreviewState] = React.useState<FightState | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const poseOpponent = params.get('pose');
    const oppAction = params.get('action');
    const playerAction = params.get('player');
    const frameParam = params.get('frame');

    if (poseOpponent) {
      const preview = createFight(poseOpponent, 12345);
      const actionFrameNum = frameParam !== null ? parseInt(frameParam, 10) : 0;
      if (oppAction) {
        preview.opponent.action = oppAction as OpponentActionType;
        preview.opponent.actionFrame = actionFrameNum;
      }
      if (playerAction) {
        preview.player.action = playerAction as ActionType;
        preview.player.actionFrame = actionFrameNum;
      }
      setPosePreviewState(preview);
    }
  }, []);

  // Ensure AudioContext is unlocked on first interaction
  React.useEffect(() => {
    const unlockAudio = async () => {
      if (!soundEngine.isInitialized()) {
        soundEngine.init();
        await soundEngine.resume();
      }
      if (gameState === GameState.MENU) {
        soundEngine.playMenuTheme();
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [gameState]);

  // Determine current effective state for rendering
  const activeState = posePreviewState || fightState;
  const isPlayerHit = activeState.player.action === 'HIT';
  const effectiveGameState = posePreviewState ? 'PLAYING' : GameState[gameState];
  const isPlaying = effectiveGameState === 'PLAYING';

  return (
    <div 
      data-game-state={effectiveGameState}
      data-referee-count={activeState.referee.count}
      className={`fixed inset-0 w-full h-[100dvh] bg-slate-950 overflow-hidden flex flex-col items-center select-none touch-none ${isPlayerHit ? 'animate-shake' : ''}`}
    >
      {/* CSS Shake Animation */}
      <style>{`
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .animate-shake {
          animation: shake 0.5s;
        }
      `}</style>

      {/* CRT Effects */}
      {!posePreviewState && (
        <>
          <div className="scanlines"></div>
          <div className="crt-flicker"></div>
        </>
      )}

      {/* --- STATUS EFFECTS OVERLAY --- */}
      {activeSpecial === 'INVERTED' && (
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 text-purple-400 font-bold bg-slate-900/80 px-4 py-2 border border-purple-500 rounded animate-pulse text-xs">
          <RefreshCcw className="animate-spin" size={16} /> CONTROLS INVERTED
        </div>
      )}
      {activeSpecial === 'BIG_LIE' && (
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 text-red-500 font-bold bg-slate-900/80 px-4 py-2 border border-red-500 rounded animate-pulse text-xs">
          <AlertTriangle size={16} /> ATTACKS REFLECTED
        </div>
      )}

      {/* Feedback message banner (only shown outside of PLAYING fights per Requirement 10) */}
      {!isPlaying && feedbackMessage && (
        <div className="absolute top-16 text-yellow-400 text-2xl md:text-5xl animate-bounce font-bold drop-shadow-[0_4px_0_rgba(0,0,0,1)] stroke-black tracking-tighter whitespace-nowrap z-50 pointer-events-none">
          {feedbackMessage}
        </div>
      )}

      {/* --- Game Scene (NES Canvas Renderer) --- */}
      <div 
        data-testid="opponent-fighter"
        className="relative w-full flex-1 flex flex-col items-center justify-center overflow-hidden bg-black min-h-0 shadow-2xl"
      >
        <GameCanvas state={activeState} isPosePreview={!!posePreviewState} />
      </div>

      {/* --- Menus (Overlay) --- */}
      {gameState === GameState.MENU && !posePreviewState && (
        <div className="absolute inset-0 bg-slate-900/95 z-[60] flex flex-col items-center justify-center gap-6 text-center p-4">
          <h1 className="text-4xl md:text-7xl text-green-400 font-retro animate-pulse drop-shadow-[0_0_15px_rgba(0,255,0,0.8)] tracking-tighter">
            MEDI<br />KNOCKOUT 2D
          </h1>
          <div className="border-4 border-green-500 p-4 md:p-8 rounded-lg bg-slate-800/80 max-w-lg backdrop-blur-md shadow-2xl">
            <p className="mb-4 text-green-300 font-bold flex items-center justify-center gap-2 text-lg font-retro">
              <Info size={20} /> HOW TO FIGHT
            </p>
            <div className="grid grid-cols-2 gap-4 text-left text-xs md:text-sm text-slate-200 font-mono">
              <div className="flex flex-col gap-1">
                <span className="text-green-400 font-bold">ATTACK</span>
                <span className="text-[10px]">Tap <span className="text-white border border-slate-500 px-1 rounded">Z/X</span> or <span className="text-white border border-slate-500 px-1 rounded">Buttons</span></span>
                <span className="text-[10px]">Head: Hold <span className="text-white border border-slate-500 px-1 rounded">UP/Toggle</span></span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-yellow-400 font-bold">DEFENSE</span>
                <span className="text-[10px]">Dodge: <span className="text-white border border-slate-500 px-1 rounded">LEFT/RIGHT</span></span>
                <span className="text-[10px]">Block: Hold <span className="text-white border border-slate-500 px-1 rounded">DOWN</span></span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 items-center">
            <button 
              data-testid="enter-ring-button"
              onClick={() => {
                soundEngine.init();
                soundEngine.resume();
                resetGame(false);
              }}
              className="flex items-center gap-3 px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-retro text-lg rounded shadow-[0_0_25px_rgba(34,197,94,0.6)] transition-all transform hover:scale-110 active:scale-95"
            >
              <Play size={20} /> ENTER RING
            </button>

            {/* Roster Opponent Selectors */}
            <div className="flex flex-wrap gap-2 justify-center max-w-md mt-2">
              {ROSTER.map((opp) => (
                <button
                  key={opp.id}
                  data-testid={`select-opponent-${opp.id}`}
                  onClick={() => {
                    soundEngine.init();
                    soundEngine.resume();
                    resetGame(opp.id);
                  }}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-retro text-[10px] rounded border border-slate-600 transition-all hover:scale-105"
                >
                  {opp.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- ENTRANCE SCREEN --- */}
      {gameState === GameState.ENTRANCE && !posePreviewState && (
        <div className="absolute inset-0 bg-slate-950 z-[60] flex flex-col items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-red-900/20 animate-pulse"></div>
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_25%,rgba(255,255,255,0.05)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.05)_75%,rgba(255,255,255,0.05)_100%)] bg-[size:40px_40px] opacity-20"></div>

          <h2 className="text-9xl font-retro text-white italic -skew-x-12 drop-shadow-[0_0_20px_rgba(255,0,0,0.8)] animate-bounce mb-8 z-10">VS</h2>

          <div className="flex flex-col items-center z-10 animate-in fade-in zoom-in duration-700">
            <h1 className="text-5xl md:text-7xl text-red-500 font-retro uppercase tracking-widest drop-shadow-lg mb-2">{currentOpponent.name}</h1>
            <p className="text-xl text-slate-300 font-mono bg-black/50 px-4 py-1 rounded mb-8">"{currentOpponent.description}"</p>
          </div>
        </div>
      )}

      {/* --- VICTORY SCREEN --- */}
      {gameState === GameState.VICTORY && !posePreviewState && (
        <div className="absolute inset-0 bg-green-900/90 z-[60] flex flex-col items-center justify-center animate-fade-in text-center backdrop-blur-sm p-4">
          <Trophy size={80} className="text-yellow-400 mb-4 animate-bounce drop-shadow-[0_0_30px_rgba(255,215,0,0.8)]" />
          <h2 className="text-5xl md:text-7xl font-retro text-white mb-2 drop-shadow-xl italic transform -skew-x-12">KO!</h2>
          <p className="text-xl md:text-3xl text-green-200 mb-8 font-mono tracking-widest">YOU DEFEATED {currentOpponent.name}</p>
          <button onClick={() => resetGame(true)} className="px-8 py-4 bg-white text-green-900 font-bold rounded hover:bg-gray-200 font-retro text-lg shadow-xl transform transition hover:scale-105">NEXT FIGHT</button>
        </div>
      )}

      {/* --- GAME OVER SCREEN --- */}
      {gameState === GameState.GAME_OVER && !posePreviewState && (
        <div className="absolute inset-0 bg-red-900/90 z-[60] flex flex-col items-center justify-center animate-fade-in text-center backdrop-blur-sm p-4">
          <Skull size={80} className="text-slate-200 mb-4 animate-pulse drop-shadow-[0_0_30px_rgba(255,0,0,0.8)]" />
          <h2 className="text-5xl md:text-7xl font-retro text-white mb-2 drop-shadow-xl italic transform -skew-x-12">TKO</h2>
          <p className="text-xl md:text-3xl text-red-200 mb-8 font-mono tracking-widest">DOWN FOR THE COUNT</p>
          <button onClick={() => resetGame(false)} className="px-8 py-4 bg-white text-red-900 font-bold rounded hover:bg-gray-200 font-retro text-lg shadow-xl transform transition hover:scale-105">REMATCH</button>
        </div>
      )}

      {/* --- Controls Area --- */}
      {!posePreviewState && (
        <div className="w-full h-[25%] min-h-[160px] max-h-[180px] md:h-[22%] bg-slate-950 border-t-4 border-slate-700 relative z-50 flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
          {gameState === GameState.PLAYING && (
            <Controls onAction={handlePlayerInput} onReleaseBlock={releaseBlock} />
          )}
        </div>
      )}
    </div>
  );
};

export default App;
