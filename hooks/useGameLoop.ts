
import { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, PlayerAction, OpponentAction, FighterStats, HitType } from '../types';
import { 
  PLAYER_MAX_HP, STAMINA_REGEN, 
  PUNCH_STAMINA_COST, PUNCH_DAMAGE_BODY, PUNCH_DAMAGE_HEAD, 
  ACTION_DURATION, OPPONENT_MOVES, COUNTER_MULTIPLIER,
  AI_PATTERNS, AI_SETTINGS, ROSTER, MAX_PLAYER_COMBO, SPECIAL_STATS
} from '../constants';
import { soundEngine } from '../utils/sound';

export const useGameLoop = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  
  // Opponent Roster State
  const [opponentIndex, setOpponentIndex] = useState(0);
  const currentOpponent = ROSTER[opponentIndex];

  // Refs
  const playerStats = useRef<FighterStats>({ hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, stamina: 100, maxStamina: 100, superMeter: 0 });
  const opponentStats = useRef<FighterStats>({ hp: currentOpponent.stats.maxHp, maxHp: currentOpponent.stats.maxHp, stamina: 100, maxStamina: 100, superMeter: 0 });
  
  const playerState = useRef<PlayerAction>(PlayerAction.IDLE);
  const opponentState = useRef<OpponentAction>(OpponentAction.IDLE);
  const lastHitType = useRef<HitType>('NONE');
  
  const playerActionEndTime = useRef<number>(0);
  const opponentActionEndTime = useRef<number>(0);
  
  // Timer Refs
  const victoryTimeout = useRef<NodeJS.Timeout | null>(null);
  const gameOverTimeout = useRef<NodeJS.Timeout | null>(null);

  // AI Specific Refs
  const aiQueue = useRef<string[]>([]); 
  const aiNextDecisionTime = useRef<number>(0);
  const aiAggressionMod = useRef<number>(1.0); // 1.0 = normal, 0.5 = 2x speed (aggression)
  
  // Special Status Refs
  const specialStatus = useRef({
      invertedUntil: 0,     // DJ Tito
      bigLieUntil: 0,       // MAGA Man
      doubleDamageUntil: 0, // Mr Yankee / Medi Jinx (Next hit)
      speedBoostUntil: 0,   // Medi Jinx (Next hit)
  });
  
  // Game Logic Refs
  const playerComboCount = useRef<number>(0);
  const difficultyMultiplier = useRef<number>(1.0);

  // React State
  const [renderTrigger, setRenderTrigger] = useState(0); 
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const triggerFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 1200);
  };

  const resetGame = (nextOpponent = false) => {
    // Clear any pending timeouts
    if (victoryTimeout.current) clearTimeout(victoryTimeout.current);
    if (gameOverTimeout.current) clearTimeout(gameOverTimeout.current);
    
    // Initialize sound if not already
    soundEngine.init();
    soundEngine.resume();
    
    // Roster Progression Logic
    let nextIndex = opponentIndex;
    if (nextOpponent) {
        nextIndex = (opponentIndex + 1) % ROSTER.length; // Cycle or loop
        if (nextIndex === 0) {
            difficultyMultiplier.current += 0.2; // Increase difficulty by 20% each loop
            triggerFeedback("LEVEL UP!");
        }
        setOpponentIndex(nextIndex);
    } else {
        // Restarting (Game Over or Menu) resets difficulty
        difficultyMultiplier.current = 1.0;
        nextIndex = 0;
        setOpponentIndex(0);
    }
    
    // Setup Stats
    const opp = ROSTER[nextIndex];
    const scaledHp = Math.floor(opp.stats.maxHp * difficultyMultiplier.current);

    playerStats.current = { hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, stamina: 100, maxStamina: 100, superMeter: 0 };
    opponentStats.current = { hp: scaledHp, maxHp: scaledHp, stamina: 100, maxStamina: 100, superMeter: 0 };
    
    playerState.current = PlayerAction.IDLE;
    opponentState.current = OpponentAction.IDLE;
    lastHitType.current = 'NONE';
    aiQueue.current = [];
    aiNextDecisionTime.current = Date.now() + 1000;
    playerComboCount.current = 0;
    aiAggressionMod.current = 1.0;
    
    specialStatus.current = { invertedUntil: 0, bigLieUntil: 0, doubleDamageUntil: 0, speedBoostUntil: 0 };

    setGameState(GameState.ENTRANCE);
    
    // Play Entrance Theme & Announce
    soundEngine.playEntrance(opp.id);

    // Transition to Fight after entrance
    setTimeout(() => {
        setGameState(GameState.PLAYING);
        setFeedbackMessage("FIGHT!");
        soundEngine.playStart();
    }, 4000);
  };

  // --- AI Logic ---
  const processOpponentAI = (now: number) => {
    if (gameState !== GameState.PLAYING) return;
    if (opponentState.current === OpponentAction.KO) return;

    // If Hit or Stunned, logic is paused until recovery
    if (now < opponentActionEndTime.current) {
        return; 
    }

    const isTelegraphing = opponentState.current.toString().startsWith('TELEGRAPH');
    
    // Recovery Phase: After an action, go to Idle and set delay
    if (opponentState.current !== OpponentAction.IDLE && !isTelegraphing && opponentState.current !== OpponentAction.KO) {
      opponentState.current = OpponentAction.IDLE;
      
      const isCombos = aiQueue.current.length > 0;
      let delay = isCombos ? AI_SETTINGS.COMBO_INTERVAL : AI_SETTINGS.RECOVERY_BASE;
      
      // Speed Mod: As HP drops, AI gets faster (Desperation)
      const hpPercent = opponentStats.current.hp / opponentStats.current.maxHp;
      if (hpPercent < 0.3) delay *= 0.6; // 40% faster when critical
      
      // Apply Aggression Mod (e.g., DJ Tito Special)
      delay *= aiAggressionMod.current;

      const speedMod = currentOpponent.stats.speed;
      aiNextDecisionTime.current = now + (delay * speedMod);
    }

    // Check Expired Specials
    if (aiAggressionMod.current !== 1.0 && now > specialStatus.current.invertedUntil) {
        aiAggressionMod.current = 1.0; // Reset aggression after Run It Back ends
    }

    // Decision Phase
    if (opponentState.current === OpponentAction.IDLE && now >= aiNextDecisionTime.current) {
        if (aiQueue.current.length > 0) {
            const nextMoveKey = aiQueue.current.shift();
            startOpponentMove(nextMoveKey, now);
        } else {
            selectNewPattern(now);
        }
    }
  };

  const selectNewPattern = (now: number) => {
    const hpPercent = opponentStats.current.hp / opponentStats.current.maxHp;
    const rand = Math.random();

    // --- CHECK FOR SPECIAL MOVE TRIGGERS ---
    // Increased probability: 35% chance normally, 60% if HP < 50%
    const canTriggerSpecial = rand < 0.35 || (hpPercent < 0.5 && rand < 0.6);
    
    if (canTriggerSpecial) {
        if (currentOpponent.id === 'aint_man') {
            // "BOUNTYGATE PUNCHES" - 3 Punch Combo
            triggerFeedback("BOUNTYGATE!");
            aiQueue.current = [...AI_PATTERNS.BOUNTYGATE];
            return;
        }
        else if (currentOpponent.id === 'medi_jinx') {
            // "BOOK IT" - Double Damage Fast Uppercut
            triggerFeedback("BOOK IT!");
            specialStatus.current.doubleDamageUntil = now + 2000;
            specialStatus.current.speedBoostUntil = now + 2000; // Next move is fast
            aiQueue.current = ['UPPERCUT_LEFT'];
            return;
        }
        else if (currentOpponent.id === 'dj_tito' && now > specialStatus.current.invertedUntil) {
            // "RUN IT BACK" - Inverted Controls + Aggression
            triggerFeedback("RUN IT BACK!");
            specialStatus.current.invertedUntil = now + SPECIAL_STATS.RUN_IT_BACK_DURATION;
            aiAggressionMod.current = 0.5; // 50% faster recovery (more aggressive)
            return;
        }
        else if (currentOpponent.id === 'mr_yankee') {
            // "PINSTRIPE PUNCHES" - 5 Hit Combo + Double Damage
            triggerFeedback("PINSTRIPE!");
            specialStatus.current.doubleDamageUntil = now + 5000; // Lasts for the combo
            aiQueue.current = [...AI_PATTERNS.PINSTRIPE_PUNCHES];
            return;
        }
        else if (currentOpponent.id === 'maga_man' && now > specialStatus.current.bigLieUntil) {
            // "BIG LIE" - Self Harm Mode
            triggerFeedback("BIG LIE!");
            specialStatus.current.bigLieUntil = now + SPECIAL_STATS.BIG_LIE_DURATION;
            return;
        }
    }

    // Standard Logic
    let pattern: string[] = [];

    if (currentOpponent.aiPatternOverride && (rand > 0.6)) {
        pattern = [...currentOpponent.aiPatternOverride];
    } else if (hpPercent < 0.3) {
        pattern = [...AI_PATTERNS.THE_CRUSHER];
    } else if (rand < 0.4) {
        pattern = [...AI_PATTERNS.BASIC_ONE_TWO];
    } else {
        pattern = [...AI_PATTERNS.HOOK_COMBO];
    }

    // Reflex Block
    if (hpPercent > 0.3 && Math.random() < 0.15) {
        opponentState.current = Math.random() > 0.5 ? OpponentAction.BLOCK_HIGH : OpponentAction.BLOCK_LOW;
        opponentActionEndTime.current = Date.now() + OPPONENT_MOVES.BLOCK.duration;
        aiNextDecisionTime.current = opponentActionEndTime.current + 100; 
        return; 
    }

    aiQueue.current = pattern;
  };

  const startOpponentMove = (moveKey: string | undefined, now: number) => {
    if (!moveKey) return;

    let action = OpponentAction.IDLE;
    let duration = 0;

    switch (moveKey) {
        case 'JAB_LEFT': action = OpponentAction.TELEGRAPH_JAB_LEFT; duration = OPPONENT_MOVES.JAB.telegraph; break;
        case 'JAB_RIGHT': action = OpponentAction.TELEGRAPH_JAB_RIGHT; duration = OPPONENT_MOVES.JAB.telegraph; break;
        case 'HOOK_LEFT': action = OpponentAction.TELEGRAPH_HOOK_LEFT; duration = OPPONENT_MOVES.HOOK.telegraph; break;
        case 'HOOK_RIGHT': action = OpponentAction.TELEGRAPH_HOOK_RIGHT; duration = OPPONENT_MOVES.HOOK.telegraph; break;
        case 'UPPERCUT_LEFT': action = OpponentAction.TELEGRAPH_UPPERCUT_LEFT; duration = OPPONENT_MOVES.UPPERCUT.telegraph; break;
        case 'UPPERCUT_RIGHT': action = OpponentAction.TELEGRAPH_UPPERCUT_RIGHT; duration = OPPONENT_MOVES.UPPERCUT.telegraph; break;
        case 'BLOCK_HIGH': action = OpponentAction.BLOCK_HIGH; duration = OPPONENT_MOVES.BLOCK.duration; break;
        case 'BLOCK_LOW': action = OpponentAction.BLOCK_LOW; duration = OPPONENT_MOVES.BLOCK.duration; break;
    }

    // Apply speed stats
    duration = duration * currentOpponent.stats.speed;

    // Apply Special Speed Boost (Medi Jinx "Book It")
    if (now < specialStatus.current.speedBoostUntil) {
        duration = duration * SPECIAL_STATS.BOOK_IT_SPEED;
    }

    opponentState.current = action;
    opponentActionEndTime.current = now + duration;
  };

  // --- Combat Logic ---
  const processCombat = (now: number) => {
    // 1. Resolve Opponent Telegraphs -> Punches
    if (opponentState.current.toString().startsWith('TELEGRAPH') && now >= opponentActionEndTime.current) {
      let nextAction = OpponentAction.IDLE;
      let moveType = "JAB";

      if (opponentState.current === OpponentAction.TELEGRAPH_JAB_LEFT) { nextAction = OpponentAction.PUNCH_JAB_LEFT; moveType="JAB"; }
      else if (opponentState.current === OpponentAction.TELEGRAPH_JAB_RIGHT) { nextAction = OpponentAction.PUNCH_JAB_RIGHT; moveType="JAB"; }
      else if (opponentState.current === OpponentAction.TELEGRAPH_HOOK_LEFT) { nextAction = OpponentAction.PUNCH_HOOK_LEFT; moveType="HOOK"; }
      else if (opponentState.current === OpponentAction.TELEGRAPH_HOOK_RIGHT) { nextAction = OpponentAction.PUNCH_HOOK_RIGHT; moveType="HOOK"; }
      else if (opponentState.current === OpponentAction.TELEGRAPH_UPPERCUT_LEFT) { nextAction = OpponentAction.PUNCH_UPPERCUT_LEFT; moveType="UPPERCUT"; }
      else if (opponentState.current === OpponentAction.TELEGRAPH_UPPERCUT_RIGHT) { nextAction = OpponentAction.PUNCH_UPPERCUT_RIGHT; moveType="UPPERCUT"; }

      const stats = OPPONENT_MOVES[moveType as "JAB" | "HOOK" | "UPPERCUT"];
      
      // Swing sound for opponent
      soundEngine.playSwing();
      soundEngine.playGrunt(true); // Opponent grunt
      
      opponentState.current = nextAction;
      opponentActionEndTime.current = now + stats.duration;

      // Apply Character Power Multiplier AND Difficulty Multiplier
      let finalDamage = Math.floor(stats.damage * currentOpponent.stats.power * difficultyMultiplier.current);

      // Special Damage Multipliers (Medi Jinx / Mr Yankee)
      if (now < specialStatus.current.doubleDamageUntil) {
          finalDamage *= 2;
      }
      // Big Lie Multiplier (MAGA Man)
      if (now < specialStatus.current.bigLieUntil) {
          finalDamage *= SPECIAL_STATS.BIG_LIE_DMG_MULT;
      }

      checkPlayerDefense(finalDamage);
    }

    // 2. Reset Player State (if not blocking/dodging)
    const isPlayerBusy = playerState.current !== PlayerAction.IDLE && playerState.current !== PlayerAction.BLOCK;
    if (isPlayerBusy && now > playerActionEndTime.current && playerState.current !== PlayerAction.KO) {
       playerState.current = PlayerAction.IDLE;
    }
  };

  const checkPlayerDefense = (damage: number) => {
    // Dodge Window
    if (playerState.current === PlayerAction.DODGE_LEFT || playerState.current === PlayerAction.DODGE_RIGHT) {
        triggerFeedback("DODGE!");
        playerStats.current.stamina = Math.min(playerStats.current.maxStamina, playerStats.current.stamina + 10); // Reward for dodge
        soundEngine.playDodge();
        return;
    }

    // Hit Logic
    playerComboCount.current = 0; // Reset combo on hit

    if (playerState.current === PlayerAction.BLOCK) {
      const chipDamage = Math.floor(damage * 0.15); 
      playerStats.current.hp = Math.max(0, playerStats.current.hp - chipDamage);
      triggerFeedback("BLOCKED!");
      soundEngine.playHit('BLOCK');
    } 
    else {
      playerStats.current.hp = Math.max(0, playerStats.current.hp - damage);
      playerState.current = PlayerAction.HIT;
      playerActionEndTime.current = Date.now() + ACTION_DURATION.HIT;
      triggerFeedback("OUCH!");
      soundEngine.playHit('HEAD');
      soundEngine.playGrunt(false); // Player Grunt
    }

    // CHECK PLAYER KO
    if (playerStats.current.hp <= 0) {
      playerState.current = PlayerAction.KO;
      triggerFeedback("KNOCKOUT!");
      soundEngine.playKO();
      gameOverTimeout.current = setTimeout(() => {
        setGameState(GameState.GAME_OVER);
      }, 3000);
    }
  };

  const handlePlayerInput = useCallback((action: PlayerAction) => {
    if (gameState !== GameState.PLAYING) return;
    const now = Date.now();

    if (playerState.current === PlayerAction.HIT || playerState.current === PlayerAction.KO) return;
    const isDodging = playerState.current === PlayerAction.DODGE_LEFT || playerState.current === PlayerAction.DODGE_RIGHT;
    
    // Allow interrupting some states, but not while mid-punch or hit
    if (playerState.current !== PlayerAction.IDLE && playerState.current !== PlayerAction.BLOCK && !isDodging && now < playerActionEndTime.current) return;

    // --- SPECIAL: INVERTED CONTROLS (DJ TITO "RUN IT BACK") ---
    let finalAction = action;
    if (now < specialStatus.current.invertedUntil) {
        switch (action) {
            case PlayerAction.DODGE_LEFT: finalAction = PlayerAction.DODGE_RIGHT; break;
            case PlayerAction.DODGE_RIGHT: finalAction = PlayerAction.DODGE_LEFT; break;
            case PlayerAction.PUNCH_LEFT_BODY: finalAction = PlayerAction.PUNCH_RIGHT_BODY; break;
            case PlayerAction.PUNCH_RIGHT_BODY: finalAction = PlayerAction.PUNCH_LEFT_BODY; break;
            case PlayerAction.PUNCH_LEFT_HEAD: finalAction = PlayerAction.PUNCH_RIGHT_HEAD; break;
            case PlayerAction.PUNCH_RIGHT_HEAD: finalAction = PlayerAction.PUNCH_LEFT_HEAD; break;
        }
    }

    // -- AI Reflex Block Check --
    if (finalAction.startsWith('PUNCH') && opponentState.current === OpponentAction.IDLE && now > opponentActionEndTime.current) {
        if (Math.random() < AI_SETTINGS.REFLEX_BLOCK_CHANCE) {
             const blockType = finalAction.includes('HEAD') ? OpponentAction.BLOCK_HIGH : OpponentAction.BLOCK_LOW;
             opponentState.current = blockType;
             opponentActionEndTime.current = now + OPPONENT_MOVES.BLOCK.duration;
             aiNextDecisionTime.current = now + OPPONENT_MOVES.BLOCK.duration + 200;
        }
    }

    if (finalAction === PlayerAction.BLOCK) {
      playerState.current = PlayerAction.BLOCK;
      return;
    }

    if (finalAction === PlayerAction.DODGE_LEFT || finalAction === PlayerAction.DODGE_RIGHT) {
        if (playerStats.current.stamina < 5) return; 
        playerStats.current.stamina -= 5;
        playerState.current = finalAction;
        playerActionEndTime.current = now + ACTION_DURATION.DODGE;
        soundEngine.playDodge();
        return;
    }

    if (finalAction.startsWith('PUNCH')) {
        if (playerStats.current.stamina < PUNCH_STAMINA_COST) {
            triggerFeedback("TIRED!");
            return;
        }

        playerStats.current.stamina -= PUNCH_STAMINA_COST;
        playerState.current = finalAction;
        playerActionEndTime.current = now + ACTION_DURATION.PUNCH;
        soundEngine.playSwing(); // Whoosh sound
        checkPlayerAttack(finalAction);
    }

  }, [gameState, currentOpponent]);

  const releaseBlock = useCallback(() => {
    if (playerState.current === PlayerAction.BLOCK) {
      playerState.current = PlayerAction.IDLE;
    }
  }, []);

  const checkPlayerAttack = (action: PlayerAction) => {
    const now = Date.now();
    let damage = action.includes('HEAD') ? PUNCH_DAMAGE_HEAD : PUNCH_DAMAGE_BODY;
    let isCounter = false;
    let hitType: HitType = action.includes('HEAD') ? 'HEAD' : 'BODY';
    
    // --- SPECIAL: BIG LIE (MAGA MAN) ---
    // User punch causes SELF DAMAGE
    if (now < specialStatus.current.bigLieUntil) {
        playerStats.current.hp = Math.max(0, playerStats.current.hp - 10); // Self harm
        triggerFeedback("FAKE NEWS!"); 
        soundEngine.playHit('HEAD');
        return; // Don't damage opponent
    }

    // 1. Check if Opponent Blocking
    if (opponentState.current === OpponentAction.BLOCK_HIGH && action.includes('HEAD')) {
        damage = 0;
        triggerFeedback("BLOCKED!");
        soundEngine.playHit('BLOCK');
        playerComboCount.current = 0; 
        return; 
    }
    else if (opponentState.current === OpponentAction.BLOCK_LOW && action.includes('BODY')) {
        damage = 0;
        triggerFeedback("BLOCKED!");
        soundEngine.playHit('BLOCK');
        playerComboCount.current = 0;
        return;
    }
    
    // 2. Counter Logic (Hitting during telegraph)
    if (opponentState.current.toString().startsWith('TELEGRAPH')) {
      damage *= COUNTER_MULTIPLIER;
      triggerFeedback("COUNTER!");
      
      opponentState.current = OpponentAction.STUNNED;
      opponentActionEndTime.current = now + ACTION_DURATION.STUNNED;
      
      aiQueue.current = [];
      aiNextDecisionTime.current = now + ACTION_DURATION.STUNNED + 500;
      isCounter = true;
    } 
    else if (opponentState.current === OpponentAction.STUNNED) {
      damage *= 1.2; 
    }

    // 3. COMBO LIMITER LOGIC
    playerComboCount.current += 1;
    if (playerComboCount.current >= MAX_PLAYER_COMBO) {
        triggerFeedback("COMBO BREAKER!");
        playerComboCount.current = 0;

        // Force AI to Block/Counter immediately
        opponentState.current = Math.random() > 0.5 ? OpponentAction.BLOCK_HIGH : OpponentAction.BLOCK_LOW;
        opponentActionEndTime.current = now + 800;
        aiNextDecisionTime.current = now + 900;
        return; 
    }

    // Apply Damage
    opponentStats.current.hp = Math.max(0, opponentStats.current.hp - damage);
    
    // Hit Reaction
    if (damage > 0 && !isCounter && opponentState.current !== OpponentAction.STUNNED && opponentState.current !== OpponentAction.KO) {
        lastHitType.current = hitType; // Track for animation
        opponentState.current = OpponentAction.HIT;
        opponentActionEndTime.current = now + ACTION_DURATION.HIT;
        aiNextDecisionTime.current = now + ACTION_DURATION.HIT + 100;
        
        // Sound FX
        soundEngine.playHit(hitType);
        soundEngine.playGrunt(true); // Opponent grunt
        soundEngine.playCrowd('HIGH'); // Crowd reacts
    }

    // CHECK OPPONENT KO
    if (opponentStats.current.hp <= 0 && opponentState.current !== OpponentAction.KO) {
        opponentState.current = OpponentAction.KO;
        triggerFeedback("KNOCKOUT!");
        soundEngine.playKO(); // Victory Music
        victoryTimeout.current = setTimeout(() => {
            setGameState(GameState.VICTORY);
        }, 3000);
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      const now = Date.now();
      if (gameState === GameState.PLAYING) {
        if (playerStats.current.stamina < playerStats.current.maxStamina) {
            playerStats.current.stamina = Math.min(playerStats.current.maxStamina, playerStats.current.stamina + STAMINA_REGEN);
        }
        processOpponentAI(now);
        processCombat(now);
      }
      setRenderTrigger(prev => prev + 1);
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState]);

  // Expose special status for UI
  const getActiveSpecial = () => {
     const now = Date.now();
     if (now < specialStatus.current.invertedUntil) return 'INVERTED';
     if (now < specialStatus.current.bigLieUntil) return 'BIG_LIE';
     return null;
  }

  return {
    gameState,
    playerStats: playerStats.current,
    opponentStats: opponentStats.current,
    playerState: playerState.current,
    opponentState: opponentState.current,
    lastHitType: lastHitType.current,
    feedbackMessage,
    currentOpponent,
    activeSpecial: getActiveSpecial(),
    handlePlayerInput,
    releaseBlock,
    resetGame
  };
};
