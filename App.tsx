import React, { useState, useEffect, useCallback } from 'react';
import { useGameLoop } from './hooks/useGameLoop';
import Controls from './components/Controls';
import { GameCanvas, ScreenMode } from './components/GameCanvas';
import { GameState, PlayerAction } from './types';
import { soundEngine } from './utils/sound';
import { ROSTER } from './constants';
import { createFight } from './src/core/engine';
import { FightState, ActionType, OpponentActionType } from './src/core/types';
import { Volume2, VolumeX } from 'lucide-react';
import { CIRCUIT_ROSTER_IDS } from './src/render/screens/presentationData';

const App: React.FC = () => {
  const { 
    gameState, 
    setGameState,
    advanceRound,
    feedbackMessage, 
    currentOpponent, 
    activeSpecial, 
    fightState, 
    handlePlayerInput, 
    releaseBlock, 
    resetGame 
  } = useGameLoop();

  // Pose preview route support via URL query parameters
  const [posePreviewState, setPosePreviewState] = useState<FightState | null>(null);

  // Canvas screen progression state
  // In MENU: can be on Title ('TITLE') or Circuit select ('CIRCUIT')
  const [menuSubState, setMenuSubState] = useState<'TITLE' | 'CIRCUIT'>('TITLE');
  const [circuitSelectedIndex, setCircuitSelectedIndex] = useState(0);
  const [unlockedIndex, setUnlockedIndex] = useState(0);
  const [unlockAll, setUnlockAll] = useState(false);
  const [globalFrame, setGlobalFrame] = useState(0);
  const [isMuted, setIsMuted] = useState(soundEngine.isMuted());

  // Check URL query parameters (?unlock=all, ?debug=betweenrounds, etc.)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('unlock') === 'all') {
      setUnlockAll(true);
    }
  }, []);

  // Pose preview route support via URL query parameters
  // ?pose=<opponent_id>&action=<OpponentAction>&player=<PlayerAction>&frame=<n>
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const poseOpponent = params.get('pose');
    const oppAction = params.get('action');
    const playerAction = params.get('player');
    const frameParam = params.get('frame');

    if (poseOpponent) {
      const preview = createFight(poseOpponent, 12345);
      const actionFrameNum = frameParam !== null ? parseInt(frameParam, 10) : 0;
      const pframeParam = params.get('pframe');
      const pframeNum = pframeParam !== null ? parseInt(pframeParam, 10) : actionFrameNum;
      const isMash = params.get('mash') === '1';
      const isExh = params.get('exh') === '1';

      if (oppAction) {
        preview.opponent.action = oppAction as OpponentActionType;
        preview.opponent.actionFrame = actionFrameNum;
      }
      const hitSide = params.get('hitSide');
      const hitTarget = params.get('hitTarget');
      if (hitSide === 'LEFT' || hitSide === 'RIGHT') {
        preview.opponent.lastHitSide = hitSide;
      }
      if (hitTarget === 'HEAD' || hitTarget === 'BODY') {
        preview.opponent.lastHitTarget = hitTarget;
      }
      if (playerAction) {
        preview.player.action = playerAction as ActionType;
        preview.player.actionFrame = pframeNum;
      }
      if (isExh) {
        preview.player.isExhausted = true;
      }
      if (isMash) {
        preview.referee.downFighter = 'PLAYER';
        preview.referee.playerMashCount = 1;
        preview.frame = 8; // Global frame 8 puts windowIdx = floor(8/8) = 1 (odd -> GET_UP)
      }
      setPosePreviewState(preview);
    }
  }, []);

  // Frame tick for blinking animations (30-frame window, etc.)
  useEffect(() => {
    let animId: number;
    const loop = () => {
      setGlobalFrame((f) => (f + 1) % 60000);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Unlock audio on first user gesture
  useEffect(() => {
    const unlockAudio = async () => {
      if (!soundEngine.isInitialized()) {
        soundEngine.init();
        await soundEngine.resume();
      }
      if (gameState === GameState.MENU) {
        soundEngine.playTitleTheme();
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

  // Manage title music when entering MENU
  useEffect(() => {
    if (gameState === GameState.MENU && soundEngine.isInitialized() && !soundEngine.isMuted()) {
      soundEngine.playTitleTheme();
    }
  }, [gameState]);

  // Handle victory unlocking next opponent
  useEffect(() => {
    if (gameState === GameState.VICTORY) {
      const currIdx = CIRCUIT_ROSTER_IDS.indexOf(fightState.opponentId);
      if (currIdx >= 0) {
        setUnlockedIndex((prev) => Math.max(prev, currIdx + 1));
      }
    }
  }, [gameState, fightState.opponentId]);

  // Mute toggle helper
  const handleToggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setIsMuted(nextMuted);
  }, []);

  // Keyboard navigation for presentation screens
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 'M' or 'm' toggles mute
      if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
        return;
      }

      if (posePreviewState) return;

      // Title screen: Enter, Space advances to Circuit
      if (gameState === GameState.MENU && menuSubState === 'TITLE') {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'x') {
          soundEngine.init();
          soundEngine.resume();
          setMenuSubState('CIRCUIT');
        }
        return;
      }

      // Circuit select: Up/Down moves cursor, Enter/Space/Z/X picks opponent
      if (gameState === GameState.MENU && menuSubState === 'CIRCUIT') {
        if (e.key === 'ArrowUp' || e.key === 'w') {
          setCircuitSelectedIndex((prev) => (prev > 0 ? prev - 1 : CIRCUIT_ROSTER_IDS.length - 1));
        } else if (e.key === 'ArrowDown' || e.key === 's') {
          setCircuitSelectedIndex((prev) => (prev < CIRCUIT_ROSTER_IDS.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'x') {
          const selectedOppId = CIRCUIT_ROSTER_IDS[circuitSelectedIndex];
          const isUnlocked = unlockAll || circuitSelectedIndex <= unlockedIndex;
          if (isUnlocked) {
            soundEngine.init();
            soundEngine.resume();
            resetGame(selectedOppId);
          }
        }
        return;
      }

      // Intro screen (ENTRANCE): Enter or Space skips directly to ROUND_START
      if (gameState === GameState.ENTRANCE) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'x') {
          setGameState(GameState.ROUND_START);
        }
        return;
      }

      // Between rounds: Enter / Space / START resumes next round
      if (fightState.phase === 'BETWEEN_ROUNDS') {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'x') {
          advanceRound();
        }
        return;
      }

      // Results screens: Enter / Space / START returns to Circuit
      if (gameState === GameState.VICTORY || gameState === GameState.GAME_OVER) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'x') {
          soundEngine.stopMusic();
          setMenuSubState('CIRCUIT');
          setGameState(GameState.MENU);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameState,
    menuSubState,
    circuitSelectedIndex,
    unlockedIndex,
    unlockAll,
    fightState.phase,
    posePreviewState,
    handleToggleMute,
    resetGame,
    setGameState,
    advanceRound,
  ]);

  // Determine active canvas ScreenMode
  const activeState = posePreviewState || fightState;
  const effectiveGameState = posePreviewState ? 'PLAYING' : GameState[gameState];
  const isPlaying = effectiveGameState === 'PLAYING';

  let currentScreenMode: ScreenMode = 'FIGHT';
  if (!posePreviewState) {
    if (gameState === GameState.MENU) {
      currentScreenMode = menuSubState === 'TITLE' ? 'TITLE' : 'CIRCUIT';
    } else if (gameState === GameState.ENTRANCE) {
      currentScreenMode = 'INTRO';
    } else if (fightState.phase === 'BETWEEN_ROUNDS') {
      currentScreenMode = 'BETWEEN_ROUNDS';
    } else if (gameState === GameState.VICTORY || gameState === GameState.GAME_OVER) {
      currentScreenMode = 'RESULTS';
    } else {
      currentScreenMode = 'FIGHT';
    }
  }

  const isPlayerHit = activeState.player.action === 'HIT';

  return (
    <div 
      data-game-state={effectiveGameState}
      data-round={activeState.round}
      data-referee-count={activeState.referee.count}
      className={`fixed inset-0 w-full h-[100dvh] bg-slate-950 overflow-hidden flex flex-col items-center select-none touch-none ${isPlayerHit ? 'animate-shake' : ''}`}
    >
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



      {/* Mute Button (Requirement 9) */}
      <button
        onClick={handleToggleMute}
        data-testid="mute-toggle-button"
        title="Toggle Sound (M)"
        className="absolute top-2 right-2 z-50 p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 rounded border border-slate-700 backdrop-blur"
      >
        {isMuted ? <VolumeX size={18} className="text-red-400" /> : <Volume2 size={18} className="text-green-400" />}
      </button>

      {/* Game Canvas */}
      <div 
        data-testid="opponent-fighter"
        className="relative w-full flex-1 flex flex-col items-center justify-center overflow-hidden bg-black min-h-0 shadow-2xl"
      >
        <GameCanvas 
          state={activeState} 
          screenMode={currentScreenMode}
          circuitSelectedIndex={circuitSelectedIndex}
          unlockedIndex={unlockedIndex}
          unlockAll={unlockAll}
          frame={globalFrame}
          isPosePreview={!!posePreviewState} 
        />

        {/* Transparent test hit areas to preserve existing e2e test ids */}
        {gameState === GameState.MENU && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto">
            {/* Enter Ring hit area (title screen or quick start) */}
            <button
              data-testid="enter-ring-button"
              onClick={() => {
                soundEngine.init();
                soundEngine.resume();
                setMenuSubState('CIRCUIT');
                resetGame(false);
              }}
              style={{ opacity: 0 }}
              className="w-full h-1/2 absolute top-0 left-0 cursor-pointer"
            >
              Enter Ring
            </button>

            {/* Select opponent hit areas */}
            <div className="absolute bottom-0 w-full flex flex-wrap justify-center gap-1 opacity-0 pointer-events-auto">
              {ROSTER.map((opp) => (
                <button
                  key={opp.id}
                  data-testid={`select-opponent-${opp.id}`}
                  onClick={() => {
                    soundEngine.init();
                    soundEngine.resume();
                    resetGame(opp.id);
                  }}
                  className="px-4 py-2"
                >
                  {opp.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* On-screen Controls Area */}
      {!posePreviewState && (
        <div className="w-full h-[25%] min-h-[160px] max-h-[180px] md:h-[22%] bg-slate-950 border-t-4 border-slate-700 relative z-50 flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
          <Controls 
            onAction={(action) => {
              if (currentScreenMode === 'TITLE') {
                setMenuSubState('CIRCUIT');
              } else if (currentScreenMode === 'CIRCUIT') {
                if (action === PlayerAction.BLOCK) {
                  setCircuitSelectedIndex((prev) => (prev < CIRCUIT_ROSTER_IDS.length - 1 ? prev + 1 : 0));
                } else if (action === PlayerAction.DODGE_LEFT || action === PlayerAction.DODGE_RIGHT) {
                  setCircuitSelectedIndex((prev) => (prev > 0 ? prev - 1 : CIRCUIT_ROSTER_IDS.length - 1));
                } else if (action === PlayerAction.STAR_PUNCH || action === PlayerAction.PUNCH_RIGHT_BODY || action === PlayerAction.PUNCH_RIGHT_HEAD) {
                  const selectedOppId = CIRCUIT_ROSTER_IDS[circuitSelectedIndex];
                  resetGame(selectedOppId);
                }
              } else if (currentScreenMode === 'INTRO') {
                setGameState(GameState.ROUND_START);
              } else if (currentScreenMode === 'BETWEEN_ROUNDS') {
                advanceRound();
              } else if (currentScreenMode === 'RESULTS') {
                soundEngine.stopMusic();
                setMenuSubState('CIRCUIT');
                setGameState(GameState.MENU);
              } else {
                handlePlayerInput(action);
              }
            }} 
            onReleaseBlock={releaseBlock} 
          />
        </div>
      )}
    </div>
  );
};

export default App;
