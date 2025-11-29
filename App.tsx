
import React from 'react';
import { useGameLoop } from './hooks/useGameLoop';
import Player from './components/Player';
import Opponent from './components/Opponent';
import Controls from './components/Controls';
import Background from './components/Background';
import { GameState, PlayerAction } from './types';
import { Trophy, Skull, Play, Info, AlertTriangle, RefreshCcw } from 'lucide-react';

const App: React.FC = () => {
  const { 
    gameState, 
    playerStats, 
    opponentStats, 
    playerState, 
    opponentState,
    lastHitType,
    feedbackMessage,
    currentOpponent,
    activeSpecial,
    handlePlayerInput,
    releaseBlock,
    resetGame
  } = useGameLoop();

  // Calculate widths for health bars
  const playerHealthPercent = (playerStats.hp / playerStats.maxHp) * 100;
  const opponentHealthPercent = (opponentStats.hp / opponentStats.maxHp) * 100;
  const staminaPercent = (playerStats.stamina / playerStats.maxStamina) * 100;

  const isPlayerHit = playerState === PlayerAction.HIT;
  const isOpponentHit = opponentState.toString().startsWith('HIT');

  return (
    <div className={`relative w-full h-screen bg-slate-950 overflow-hidden flex flex-col items-center select-none ${isPlayerHit ? 'animate-shake' : ''}`}>
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
      <div className="scanlines"></div>
      <div className="crt-flicker"></div>
      
      {/* Hit Flash FX (Screen Red Flash) */}
      {isPlayerHit && (
          <div className="absolute inset-0 bg-red-600/40 z-40 animate-pulse pointer-events-none mix-blend-overlay"></div>
      )}
      
      {/* Opponent Hit Flash (White Flash) */}
      {isOpponentHit && (
          <div className="absolute inset-0 bg-white/20 z-30 pointer-events-none mix-blend-add transition-opacity duration-75"></div>
      )}

      {/* --- HUD --- */}
      <div className="w-full max-w-4xl p-4 flex justify-between items-start z-50 font-retro text-xs md:text-sm absolute top-0 left-1/2 -translate-x-1/2">
        {/* Player Stats */}
        <div className="flex flex-col gap-1 w-1/3">
          <div className="text-green-400 drop-shadow-md">LIL TANK</div>
          <div className="h-6 w-full bg-slate-800 border-2 border-slate-600 relative skew-x-[-10deg]">
             <div 
               className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-200 ease-out" 
               style={{ width: `${playerHealthPercent}%` }}
             ></div>
          </div>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-blue-300">STM</span>
             <div className="h-3 w-32 bg-slate-800 border border-slate-600">
                <div 
                    className="h-full bg-blue-400 transition-all duration-100" 
                    style={{ width: `${staminaPercent}%` }}
                ></div>
             </div>
          </div>
        </div>

        {/* Timer / Feedback */}
        <div className="text-center w-1/3 mt-8 pointer-events-none z-50">
            {feedbackMessage && (
                <div className="text-yellow-400 text-3xl md:text-5xl animate-bounce font-bold drop-shadow-[0_4px_0_rgba(0,0,0,1)] stroke-black tracking-tighter">
                    {feedbackMessage}
                </div>
            )}
        </div>

        {/* Opponent Stats */}
        <div className="flex flex-col gap-1 w-1/3 items-end">
          <div className="text-red-400 drop-shadow-md uppercase">{currentOpponent.name}</div>
          <div className="h-6 w-full bg-slate-800 border-2 border-slate-600 relative skew-x-[10deg]">
             <div 
               className="h-full bg-gradient-to-l from-red-600 to-red-400 transition-all duration-200 ease-out float-right" 
               style={{ width: `${opponentHealthPercent}%` }}
             ></div>
          </div>
        </div>
      </div>

      {/* --- STATUS EFFECTS OVERLAY --- */}
      {activeSpecial === 'INVERTED' && (
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 text-purple-400 font-bold bg-slate-900/80 px-4 py-2 border border-purple-500 rounded animate-pulse">
              <RefreshCcw className="animate-spin" size={20} /> CONTROLS INVERTED
          </div>
      )}
      {activeSpecial === 'BIG_LIE' && (
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 text-red-500 font-bold bg-slate-900/80 px-4 py-2 border border-red-500 rounded animate-pulse">
              <AlertTriangle size={20} /> ATTACKS REFLECTED
          </div>
      )}

      {/* --- Game Scene --- */}
      <div className="flex-1 w-full relative flex flex-col items-center justify-end overflow-hidden perspective-1000">
          
          {/* Enhanced Animated Background */}
          <Background isPlayerHit={isPlayerHit} isOpponentHit={isOpponentHit} gameState={gameState} />

          {/* Floor Grid - Retro Perspective (Overlay on top of background layer) */}
          <div className="absolute bottom-[-10%] w-full h-[60%] bg-[linear-gradient(rgba(0,255,100,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.1)_1px,transparent_1px)] bg-[size:50px_50px] [transform:perspective(600px)_rotateX(60deg)] origin-bottom pointer-events-none z-10 opacity-30"></div>

          {/* Opponent Layer */}
          <div className={`transition-all duration-75 z-20 origin-bottom translate-y-[25%] transform scale-[1.85]`}>
             <Opponent state={opponentState} character={currentOpponent} lastHitType={lastHitType} />
          </div>

          {/* Player Layer */}
          <div className="absolute bottom-[-5vh] z-30 origin-bottom scale-125 pointer-events-none mix-blend-screen opacity-90">
             <Player state={playerState} />
          </div>

      </div>

      {/* --- Menus --- */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center gap-6 text-center p-4">
            <h1 className="text-5xl md:text-7xl text-green-400 font-retro animate-pulse drop-shadow-[0_0_15px_rgba(0,255,0,0.8)] tracking-tighter">
                LIL TANK'S<br/>KNOCKOUT
            </h1>
            <div className="border-4 border-green-500 p-8 rounded-lg bg-slate-800/80 max-w-lg backdrop-blur-md shadow-2xl">
                <p className="mb-6 text-green-300 font-bold flex items-center justify-center gap-2 text-xl font-retro"><Info size={24}/> HOW TO FIGHT</p>
                <div className="grid grid-cols-2 gap-6 text-left text-sm text-slate-200 font-mono">
                    <div className="flex flex-col gap-1">
                        <span className="text-green-400 font-bold">ATTACK</span>
                        <span className="text-xs">Punch: <span className="text-white border border-slate-500 px-1 rounded">Z</span> / <span className="text-white border border-slate-500 px-1 rounded">X</span></span>
                        <span className="text-xs">Head Shot: Hold <span className="text-white border border-slate-500 px-1 rounded">UP</span> + Punch</span>
                    </div>
                    <div className="flex flex-col gap-1">
                         <span className="text-yellow-400 font-bold">MOVEMENT</span>
                         <span className="text-xs">Dodge: <span className="text-white border border-slate-500 px-1 rounded">LEFT</span> / <span className="text-white border border-slate-500 px-1 rounded">RIGHT</span></span>
                         <span className="text-xs">Block: Hold <span className="text-white border border-slate-500 px-1 rounded">DOWN</span></span>
                    </div>
                </div>
            </div>
            <button 
                onClick={() => resetGame(false)}
                className="flex items-center gap-3 px-10 py-5 bg-green-600 hover:bg-green-500 text-white font-retro text-xl rounded shadow-[0_0_25px_rgba(34,197,94,0.6)] transition-all transform hover:scale-110 active:scale-95 mt-4"
            >
                <Play size={24} /> ENTER RING
            </button>
        </div>
      )}

      {gameState === GameState.VICTORY && (
        <div className="absolute inset-0 bg-green-900/90 z-50 flex flex-col items-center justify-center animate-fade-in text-center backdrop-blur-sm">
             <Trophy size={100} className="text-yellow-400 mb-6 animate-bounce drop-shadow-[0_0_30px_rgba(255,215,0,0.8)]" />
             <h2 className="text-7xl font-retro text-white mb-4 drop-shadow-xl italic transform -skew-x-12">KO!</h2>
             <p className="text-3xl text-green-200 mb-12 font-mono tracking-widest">YOU DEFEATED {currentOpponent.name}</p>
             <button onClick={() => resetGame(true)} className="px-10 py-5 bg-white text-green-900 font-bold rounded hover:bg-gray-200 font-retro text-xl shadow-xl transform transition hover:scale-105">NEXT FIGHT</button>
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 bg-red-900/90 z-50 flex flex-col items-center justify-center animate-fade-in text-center backdrop-blur-sm">
             <Skull size={100} className="text-slate-200 mb-6 animate-pulse drop-shadow-[0_0_30px_rgba(255,0,0,0.8)]" />
             <h2 className="text-7xl font-retro text-white mb-4 drop-shadow-xl italic transform -skew-x-12">TKO</h2>
             <p className="text-3xl text-red-200 mb-12 font-mono tracking-widest">DOWN FOR THE COUNT</p>
             <button onClick={() => resetGame(false)} className="px-10 py-5 bg-white text-red-900 font-bold rounded hover:bg-gray-200 font-retro text-xl shadow-xl transform transition hover:scale-105">REMATCH</button>
        </div>
      )}

      {/* --- Controls --- */}
      {gameState === GameState.PLAYING && (
         <Controls onAction={handlePlayerInput} onReleaseBlock={releaseBlock} />
      )}
    </div>
  );
};

export default App;
