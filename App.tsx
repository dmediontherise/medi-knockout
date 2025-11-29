
import React from 'react';
import { useGameLoop } from './hooks/useGameLoop';
import Player from './components/Player';
import Opponent from './components/Opponent';
import Controls from './components/Controls';
import Background from './components/Background';
import { GameState, PlayerAction } from './types';
import { Trophy, Skull, Play, Info, AlertTriangle, RefreshCcw } from 'lucide-react';
import { soundEngine } from './utils/sound';

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

  // Ensure AudioContext is unlocked on first interaction
  React.useEffect(() => {
      const unlockAudio = () => {
          soundEngine.init();
          soundEngine.resume();
          // Try to play menu theme if we are in menu
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
  }, [gameState]); // Add dependency to re-check if needed

  // Calculate widths for health bars
  const playerHealthPercent = (playerStats.hp / playerStats.maxHp) * 100;
  const opponentHealthPercent = (opponentStats.hp / opponentStats.maxHp) * 100;
  const staminaPercent = (playerStats.stamina / playerStats.maxStamina) * 100;

  const isPlayerHit = playerState === PlayerAction.HIT;
  const isOpponentHit = opponentState.toString().startsWith('HIT');

  return (
    <div className={`fixed inset-0 w-full h-[100dvh] bg-slate-950 overflow-hidden flex flex-col items-center select-none touch-none ${isPlayerHit ? 'animate-shake' : ''}`}>
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
      <div className="w-full max-w-4xl p-2 pt-safe-top flex justify-between items-start z-50 font-retro text-[10px] md:text-sm absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none">
        {/* Player Stats */}
        <div className="flex flex-col gap-1 w-[40%]">
          <div className="text-green-400 drop-shadow-md flex justify-between"><span>MEDI</span> <span>LVL 1</span></div>
          <div className="h-4 md:h-6 w-full bg-slate-800 border-2 border-slate-600 relative skew-x-[-10deg]">
             <div 
               className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-200 ease-out" 
               style={{ width: `${playerHealthPercent}%` }}
             ></div>
          </div>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-blue-300 text-[8px]">STM</span>
             <div className="h-2 md:h-3 w-24 bg-slate-800 border border-slate-600">
                <div 
                    className="h-full bg-blue-400 transition-all duration-100" 
                    style={{ width: `${staminaPercent}%` }}
                ></div>
             </div>
          </div>
        </div>

        {/* Timer / Feedback */}
        <div className="text-center w-[20%] mt-4 pointer-events-none z-50 flex justify-center">
            {feedbackMessage && (
                <div className="absolute top-16 text-yellow-400 text-2xl md:text-5xl animate-bounce font-bold drop-shadow-[0_4px_0_rgba(0,0,0,1)] stroke-black tracking-tighter whitespace-nowrap">
                    {feedbackMessage}
                </div>
            )}
        </div>

        {/* Opponent Stats */}
        <div className="flex flex-col gap-1 w-[40%] items-end">
          <div className="text-red-400 drop-shadow-md uppercase text-right">{currentOpponent.name}</div>
          <div className="h-4 md:h-6 w-full bg-slate-800 border-2 border-slate-600 relative skew-x-[10deg]">
             <div 
               className="h-full bg-gradient-to-l from-red-600 to-red-400 transition-all duration-200 ease-out float-right" 
               style={{ width: `${opponentHealthPercent}%` }}
             ></div>
          </div>
        </div>
      </div>

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

      {/* --- Game Scene (Flex Grow) --- */}
      <div className="relative w-full max-w-[600px] mx-auto flex-1 flex flex-col items-center justify-end overflow-hidden perspective-1000 border-b-4 border-slate-800 bg-slate-900 min-h-0 shadow-2xl">
          
          {/* Enhanced Animated Background */}
          <Background isPlayerHit={isPlayerHit} isOpponentHit={isOpponentHit} gameState={gameState} />

          {/* Floor Grid - Retro Perspective (Overlay on top of background layer) */}
          <div className="absolute bottom-[-10%] w-full h-[60%] bg-[linear-gradient(rgba(0,255,100,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,100,0.1)_1px,transparent_1px)] bg-[size:50px_50px] [transform:perspective(600px)_rotateX(60deg)] origin-bottom pointer-events-none z-10 opacity-30"></div>

          {/* Opponent Layer */}
          <div className={`transition-all duration-75 z-20 origin-bottom translate-y-[30%] transform scale-[1.3]`}>
             <Opponent state={opponentState} character={currentOpponent} lastHitType={lastHitType} />
          </div>

          {/* Player Layer */}
          <div className="absolute bottom-[-5%] z-30 origin-bottom scale-[1.1] pointer-events-none mix-blend-screen opacity-90">
             <Player state={playerState} />
          </div>
      </div>

      {/* --- Menus (Overlay) --- */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-slate-900/95 z-[60] flex flex-col items-center justify-center gap-6 text-center p-4">
            <h1 className="text-4xl md:text-7xl text-green-400 font-retro animate-pulse drop-shadow-[0_0_15px_rgba(0,255,0,0.8)] tracking-tighter">
                MEDI<br/>KNOCKOUT 2D
            </h1>
            <div className="border-4 border-green-500 p-4 md:p-8 rounded-lg bg-slate-800/80 max-w-lg backdrop-blur-md shadow-2xl">
                <p className="mb-4 text-green-300 font-bold flex items-center justify-center gap-2 text-lg font-retro"><Info size={20}/> HOW TO FIGHT</p>
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
            <button 
                onClick={() => resetGame(false)}
                className="flex items-center gap-3 px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-retro text-lg rounded shadow-[0_0_25px_rgba(34,197,94,0.6)] transition-all transform hover:scale-110 active:scale-95 mt-4"
            >
                <Play size={20} /> ENTER RING
            </button>
        </div>
      )}

      {/* --- ENTRANCE SCREEN --- */}
      {gameState === GameState.ENTRANCE && (
        <div className="absolute inset-0 bg-slate-950 z-[60] flex flex-col items-center justify-center overflow-hidden">
            {/* Background Flash */}
            <div className="absolute inset-0 bg-red-900/20 animate-pulse"></div>
            
            {/* Animated Stripes */}
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_25%,rgba(255,255,255,0.05)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.05)_75%,rgba(255,255,255,0.05)_100%)] bg-[size:40px_40px] opacity-20"></div>

            {/* VS Text */}
            <h2 className="text-9xl font-retro text-white italic -skew-x-12 drop-shadow-[0_0_20px_rgba(255,0,0,0.8)] animate-bounce mb-8 z-10">VS</h2>

            {/* Opponent Info */}
            <div className="flex flex-col items-center z-10 animate-in fade-in zoom-in duration-700">
                <h1 className="text-5xl md:text-7xl text-red-500 font-retro uppercase tracking-widest drop-shadow-lg mb-2">{currentOpponent.name}</h1>
                <p className="text-xl text-slate-300 font-mono bg-black/50 px-4 py-1 rounded mb-8">"{currentOpponent.description}"</p>
                
                {/* Large Portrait - Slide Up Animation */}
                <div className="relative w-64 h-80 border-4 border-red-600 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.5)] bg-slate-800 animate-[slide-up_1s_ease-out_forwards]">
                     <style>{`
                        @keyframes slide-up {
                            0% { transform: translateY(100%) scale(0.5); opacity: 0; }
                            100% { transform: translateY(0) scale(1); opacity: 1; }
                        }
                     `}</style>
                     <img 
                        src={currentOpponent.spriteConfig.sheetUrl}
                        alt={currentOpponent.name}
                        className="w-full h-full object-contain object-center"
                        style={{
                            imageRendering: 'pixelated' 
                        }}
                        onError={(e) => {
                            // Fallback if image fails
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                     />
                </div>
            </div>
        </div>
      )}

      {/* --- ROUND START (Ready... Fight!) --- */}
      {gameState === GameState.ROUND_START && (
          <div className="absolute inset-0 z-[55] flex items-center justify-center pointer-events-none">
              {/* We rely on the HUD feedback message, or we can duplicate it here for emphasis */}
          </div>
      )}

      {gameState === GameState.VICTORY && (
        <div className="absolute inset-0 bg-green-900/90 z-[60] flex flex-col items-center justify-center animate-fade-in text-center backdrop-blur-sm p-4">
             <Trophy size={80} className="text-yellow-400 mb-4 animate-bounce drop-shadow-[0_0_30px_rgba(255,215,0,0.8)]" />
             <h2 className="text-5xl md:text-7xl font-retro text-white mb-2 drop-shadow-xl italic transform -skew-x-12">KO!</h2>
             <p className="text-xl md:text-3xl text-green-200 mb-8 font-mono tracking-widest">YOU DEFEATED {currentOpponent.name}</p>
             <button onClick={() => resetGame(true)} className="px-8 py-4 bg-white text-green-900 font-bold rounded hover:bg-gray-200 font-retro text-lg shadow-xl transform transition hover:scale-105">NEXT FIGHT</button>
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 bg-red-900/90 z-[60] flex flex-col items-center justify-center animate-fade-in text-center backdrop-blur-sm p-4">
             <Skull size={80} className="text-slate-200 mb-4 animate-pulse drop-shadow-[0_0_30px_rgba(255,0,0,0.8)]" />
             <h2 className="text-5xl md:text-7xl font-retro text-white mb-2 drop-shadow-xl italic transform -skew-x-12">TKO</h2>
             <p className="text-xl md:text-3xl text-red-200 mb-8 font-mono tracking-widest">DOWN FOR THE COUNT</p>
             <button onClick={() => resetGame(false)} className="px-8 py-4 bg-white text-red-900 font-bold rounded hover:bg-gray-200 font-retro text-lg shadow-xl transform transition hover:scale-105">REMATCH</button>
        </div>
      )}

      {/* --- Controls Area (Bottom 35%) --- */}
      <div className="w-full h-[35%] min-h-[220px] bg-slate-950 border-t-4 border-slate-700 relative z-50 flex-shrink-0 pb-safe-bottom">
          {gameState === GameState.PLAYING && (
             <Controls onAction={handlePlayerInput} onReleaseBlock={releaseBlock} />
          )}
      </div>
    </div>
  );
};

export default App;
