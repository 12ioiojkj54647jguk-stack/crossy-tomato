"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  COLS,
  ROWS,
  createEmptyGrid,
  generateRandomValue,
  spawnPiece,
  isValidMove,
  stabilize,
  checkGameOver,
  type Grid,
  type Piece,
} from "@/lib/gameEngine";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CELL_SIZE,
  drawRoundRect,
  formatTime,
  getBlockStyle,
} from "@/lib/gamePresentation";
import {
  addToLeaderboard,
  getScoreRank,
  loadAchievements,
  loadLeaderboard,
  saveAchievements,
  type LeaderboardEntry,
} from "@/lib/gameStorage";

// Level thresholds (experience needed for each level)
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000];

// Achievement definitions
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (stats: GameStats) => boolean;
  progress: (stats: GameStats) => number;
  target: number;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_merge",
    name: "初次合并",
    description: "完成第一次合并",
    icon: "⭐",
    condition: (s) => s.totalMerges >= 1,
    progress: (s) => Math.min(s.totalMerges, 1),
    target: 1,
  },
  {
    id: "score_100",
    name: "百分达人",
    description: "单局得分达到 100",
    icon: "💯",
    condition: (s) => s.score >= 100,
    progress: (s) => Math.min(s.score, 100),
    target: 100,
  },
  {
    id: "score_500",
    name: "高分玩家",
    description: "单局得分达到 500",
    icon: "🏆",
    condition: (s) => s.score >= 500,
    progress: (s) => Math.min(s.score, 500),
    target: 500,
  },
  {
    id: "score_1000",
    name: "千分大师",
    description: "单局得分达到 1000",
    icon: "👑",
    condition: (s) => s.score >= 1000,
    progress: (s) => Math.min(s.score, 1000),
    target: 1000,
  },
  {
    id: "combo_3",
    name: "连击新手",
    description: "达成 3 连击",
    icon: "🔥",
    condition: (s) => s.maxCombo >= 3,
    progress: (s) => Math.min(s.maxCombo, 3),
    target: 3,
  },
  {
    id: "combo_5",
    name: "连击达人",
    description: "达成 5 连击",
    icon: "🔥🔥",
    condition: (s) => s.maxCombo >= 5,
    progress: (s) => Math.min(s.maxCombo, 5),
    target: 5,
  },
  {
    id: "merge_5",
    name: "合并大师",
    description: "单次合并 5 个方块",
    icon: "💎",
    condition: (s) => s.biggestMerge >= 5,
    progress: (s) => Math.min(s.biggestMerge, 5),
    target: 5,
  },
  {
    id: "level_5",
    name: "等级提升",
    description: "达到 5 级",
    icon: "📈",
    condition: (s) => s.level >= 5,
    progress: (s) => Math.min(s.level, 5),
    target: 5,
  },
  {
    id: "pieces_50",
    name: "坚持不懈",
    description: "放置 50 个方块",
    icon: "💪",
    condition: (s) => s.totalPieces >= 50,
    progress: (s) => Math.min(s.totalPieces, 50),
    target: 50,
  },
  {
    id: "play_5min",
    name: "持久战",
    description: "单局游戏超过 5 分钟",
    icon: "⏱️",
    condition: (s) => s.gameTime >= 300,
    progress: (s) => Math.min(s.gameTime, 300),
    target: 300,
  },
];

// Game statistics
interface GameStats {
  score: number;
  level: number;
  combo: number;
  maxCombo: number;
  totalMerges: number;
  totalPieces: number;
  biggestMerge: number;
  gameTime: number;
}

interface GameSummary {
  score: number;
  level: number;
  maxCombo: number;
  totalMerges: number;
  totalPieces: number;
  isRecord: boolean;
}

const initialStats: GameStats = {
  score: 0,
  level: 1,
  combo: 0,
  maxCombo: 0,
  totalMerges: 0,
  totalPieces: 0,
  biggestMerge: 0,
  gameTime: 0,
};

function getLevel(exp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (exp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function getExpForNextLevel(level: number): number {
  return LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] * 2;
}

// Game state for undo
interface GameState {
  grid: Grid;
  score: number;
  combo: number;
  nextValue: number;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<Grid>(createEmptyGrid);
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextValue, setNextValue] = useState<number>(2);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [combo, setCombo] = useState(0);
  const [ghostY, setGhostY] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const [floatingScores, setFloatingScores] = useState<{ x: number; y: number; value: number; life: number }[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [showShareButton, setShowShareButton] = useState(false);
  const [gameSummary, setGameSummary] = useState<GameSummary | null>(null);
  
  // Level system
  const [experience, setExperience] = useState(0);
  const [level, setLevel] = useState(1);
  
  // Statistics
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [showStats, setShowStats] = useState(false);

  // Game Rules
  const [showRules, setShowRules] = useState(false);

  // Achievements
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [achievementPopup, setAchievementPopup] = useState<Achievement | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);

  const gridRef = useRef(grid);
  const currentPieceRef = useRef(currentPiece);
  const nextValueRef = useRef(nextValue);
  const scoreRef = useRef(score);
  const gameOverRef = useRef(gameOver);
  const isPausedRef = useRef(isPaused);
  const isFastDropRef = useRef(false);
  const comboRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoHistoryRef = useRef<GameState[]>([]);
  const experienceRef = useRef(0);
  const levelRef = useRef(1);
  const statsRef = useRef(initialStats);

  // Game start time
  const gameStartTimeRef = useRef(Date.now());
  
  // Touch state
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { currentPieceRef.current = currentPiece; }, [currentPiece]);
  useEffect(() => { nextValueRef.current = nextValue; }, [nextValue]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { experienceRef.current = experience; }, [experience]);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  // Load leaderboard on mount
  useEffect(() => {
    setLeaderboard(loadLeaderboard());
  }, []);

  // Calculate ghost position
  const calculateGhostY = useCallback((piece: Piece | null, currentGrid: Grid): number => {
    if (!piece) return 0;
    let y = piece.y;
    while (isValidMove(currentGrid, piece.x, y + 1)) {
      y++;
    }
    return y;
  }, []);

  // Update ghost position when piece or grid changes
  useEffect(() => {
    if (currentPiece && !gameOver && !isPaused) {
      setGhostY(calculateGhostY(currentPiece, grid));
    }
  }, [currentPiece, grid, gameOver, isPaused, calculateGhostY]);

  // Reset combo after 3 seconds of no merges
  const resetComboTimer = useCallback(() => {
    if (comboTimerRef.current) {
      clearTimeout(comboTimerRef.current);
    }
    comboTimerRef.current = setTimeout(() => {
      setCombo(0);
    }, 3000);
  }, []);

  // Add experience
  const addExperience = useCallback((points: number) => {
    const newExp = experienceRef.current + points;
    const newLevel = getLevel(newExp);
    setExperience(newExp);
    setLevel(newLevel);
    experienceRef.current = newExp;
    levelRef.current = newLevel;
  }, []);
  
  // Update statistics
  const updateStats = useCallback((updates: Partial<GameStats>) => {
    setStats(prev => {
      const newStats = { ...prev, ...updates };
      statsRef.current = newStats;
      // Check for new achievements
      const newUnlocked: string[] = [];
      for (const achievement of ACHIEVEMENTS) {
        if (!unlockedAchievements.includes(achievement.id) && achievement.condition(newStats)) {
          newUnlocked.push(achievement.id);
          // Show popup
          setAchievementPopup(achievement);
          setTimeout(() => setAchievementPopup(null), 3000);
        }
      }
      if (newUnlocked.length > 0) {
        setUnlockedAchievements(prev => [...prev, ...newUnlocked]);
      }
      return newStats;
    });
  }, [unlockedAchievements]);

  const finishGame = useCallback((finalScore: number, finalStats: GameStats = statsRef.current) => {
    const previousBest = leaderboard[0]?.score ?? 0;
    const newLeaderboard = addToLeaderboard(finalScore);
    const playerRank = getScoreRank(newLeaderboard, finalScore);

    setLeaderboard(newLeaderboard);
    setRank(playerRank);
    setGameSummary({
      score: finalScore,
      level: finalStats.level,
      maxCombo: finalStats.maxCombo,
      totalMerges: finalStats.totalMerges,
      totalPieces: finalStats.totalPieces,
      isRecord: finalScore > previousBest,
    });
    setCurrentPiece(null);
    currentPieceRef.current = null;
    setGameOver(true);
    gameOverRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;
    setShowShareButton(true);
    isFastDropRef.current = false;
  }, [leaderboard]);
  
  // Check achievements on mount
  useEffect(() => {
    setUnlockedAchievements(loadAchievements());
  }, []);
  
  // Save achievements
  useEffect(() => {
    saveAchievements(unlockedAchievements);
  }, [unlockedAchievements]);

  // Save state for undo
  const saveStateForUndo = useCallback(() => {
    const state: GameState = {
      grid: gridRef.current.map(row => [...row]),
      score: scoreRef.current,
      combo: comboRef.current,
      nextValue: nextValueRef.current,
    };
    undoHistoryRef.current.push(state);
    if (undoHistoryRef.current.length > 3) {
      undoHistoryRef.current.shift();
    }
    setUndoCount(undoHistoryRef.current.length);
  }, []);

  // Undo function
  const undo = useCallback(() => {
    if (undoHistoryRef.current.length === 0 || gameOverRef.current || isPausedRef.current) return;
    const state = undoHistoryRef.current.pop()!;
    setGrid(state.grid);
    setScore(state.score);
    setCombo(state.combo);
    setNextValue(state.nextValue);
    gridRef.current = state.grid;
    scoreRef.current = state.score;
    comboRef.current = state.combo;
    nextValueRef.current = state.nextValue;
    setUndoCount(undoHistoryRef.current.length);
    
    const piece = spawnPiece(state.nextValue);
    if (isValidMove(state.grid, piece.x, piece.y)) {
      setCurrentPiece(piece);
      currentPieceRef.current = piece;
    } else {
      setCurrentPiece(null);
      currentPieceRef.current = null;
    }
  }, []);

  const lockPiece = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece) return;

    saveStateForUndo();

    const newGrid = currentGrid.map(row => [...row]);

    if (piece.y < 0 || piece.y >= ROWS || piece.x < 0 || piece.x >= COLS || newGrid[piece.y][piece.x] !== 0) {
      finishGame(scoreRef.current);
      return;
    }

    newGrid[piece.y][piece.x] = piece.value;

    if (piece.y === 0) {
      setGrid(newGrid);
      const currentStats = statsRef.current;
      const nextStats = {
        ...currentStats,
        score: scoreRef.current,
        level: levelRef.current,
        totalPieces: currentStats.totalPieces + 1,
        gameTime: Math.floor((Date.now() - gameStartTimeRef.current) / 1000),
      };
      updateStats(nextStats);
      finishGame(scoreRef.current, nextStats);
      return;
    }

    const result = stabilize(newGrid);
    const mergeCount = result.mergeEvents.length;
    const biggestMergeThisTurn = result.mergeEvents.reduce(
      (max, event) => Math.max(max, event.positions.length),
      0
    );
    
    // Calculate experience gained
    const baseExp = piece.value; // Base exp from piece value
    const mergeBonusExp = mergeCount * 15; // Bonus for merges
    const comboBonusExp = Math.min(comboRef.current, 5) * 5; // Combo bonus
    const totalExp = baseExp + mergeBonusExp + comboBonusExp;
    addExperience(totalExp);
    
    // Update combo if merges happened
    const newCombo = mergeCount > 0 ? comboRef.current + mergeCount : comboRef.current;
    if (mergeCount > 0) {
      setCombo(newCombo);
      resetComboTimer();
    }
    
    // Update statistics
    const finalScore = result.scoreGained;
    const newScore = scoreRef.current + finalScore;
    const currentStats = statsRef.current;
    const nextStats = {
      score: newScore,
      level: levelRef.current,
      combo: newCombo,
      maxCombo: Math.max(currentStats.maxCombo, newCombo),
      totalMerges: currentStats.totalMerges + mergeCount,
      totalPieces: currentStats.totalPieces + 1,
      biggestMerge: Math.max(currentStats.biggestMerge, biggestMergeThisTurn),
      gameTime: Math.floor((Date.now() - gameStartTimeRef.current) / 1000),
    };

    updateStats(nextStats);

    // Add floating score
    if (result.scoreGained > 0) {
      setFloatingScores(prev => [...prev, {
        x: piece.x,
        y: piece.y,
        value: Math.round(finalScore),
        life: 60,
      }]);
    }
    
    setGrid(result.grid);
    setScore(newScore);
    scoreRef.current = newScore;

    if (checkGameOver(result.grid)) {
      finishGame(newScore, nextStats);
      return;
    }

    const newPiece = spawnPiece(nextValueRef.current);
    if (!isValidMove(result.grid, newPiece.x, newPiece.y)) {
      finishGame(newScore, nextStats);
      return;
    }

    setCurrentPiece(newPiece);
    currentPieceRef.current = newPiece;
    const newNext = generateRandomValue();
    setNextValue(newNext);
    nextValueRef.current = newNext;
  }, [resetComboTimer, saveStateForUndo, addExperience, updateStats, finishGame]);

  const moveDown = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    const newY = piece.y + 1;
    if (isValidMove(currentGrid, piece.x, newY)) {
      const movedPiece = { ...piece, y: newY };
      currentPieceRef.current = movedPiece;
      setCurrentPiece(movedPiece);
    } else {
      lockPiece();
    }
  }, [lockPiece]);

  const moveLeft = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    const newX = piece.x - 1;
    if (isValidMove(currentGrid, newX, piece.y)) {
      const movedPiece = { ...piece, x: newX };
      currentPieceRef.current = movedPiece;
      setCurrentPiece(movedPiece);
    }
  }, []);

  const moveRight = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    const newX = piece.x + 1;
    if (isValidMove(currentGrid, newX, piece.y)) {
      const movedPiece = { ...piece, x: newX };
      currentPieceRef.current = movedPiece;
      setCurrentPiece(movedPiece);
    }
  }, []);

  const hardDrop = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    let newY = piece.y;
    while (isValidMove(currentGrid, piece.x, newY + 1)) {
      newY++;
    }
    currentPieceRef.current = { ...piece, y: newY };
    setCurrentPiece({ ...piece, y: newY });
    lockPiece();
  }, [lockPiece]);

  // End game
  const endGame = useCallback(() => {
    if (gameOverRef.current) return;
    let finalScore = scoreRef.current;
    let finalStats = statsRef.current;

    if (currentPieceRef.current) {
      const piece = currentPieceRef.current;
      const currentGrid = gridRef.current;
      const newGrid = currentGrid.map(row => [...row]);
      if (piece.y >= 0 && piece.y < ROWS && piece.x >= 0 && piece.x < COLS && newGrid[piece.y][piece.x] === 0) {
        newGrid[piece.y][piece.x] = piece.value;
        const result = stabilize(newGrid);
        const mergeCount = result.mergeEvents.length;
        const biggestMergeThisTurn = result.mergeEvents.reduce(
          (max, event) => Math.max(max, event.positions.length),
          0
        );
        finalScore += result.scoreGained;
        finalStats = {
          ...finalStats,
          score: finalScore,
          level: levelRef.current,
          totalMerges: finalStats.totalMerges + mergeCount,
          totalPieces: finalStats.totalPieces + 1,
          biggestMerge: Math.max(finalStats.biggestMerge, biggestMergeThisTurn),
          gameTime: Math.floor((Date.now() - gameStartTimeRef.current) / 1000),
        };
        setGrid(result.grid);
        setScore(finalScore);
        scoreRef.current = finalScore;
        updateStats(finalStats);
      }
    }

    finishGame(finalScore, finalStats);
  }, [finishGame, updateStats]);

  // Share function
  const shareScore = useCallback(async () => {
    const text = `我在數字消除方塊獲得了 ${score} 分！你能超越我嗎？`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "數字消除方塊", text });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert("已複製到剪貼簿！");
    }
  }, [score]);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOverRef.current) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          moveLeft();
          break;
        case "ArrowRight":
          e.preventDefault();
          moveRight();
          break;
        case "ArrowDown":
          e.preventDefault();
          isFastDropRef.current = true;
          moveDown();
          break;
        case "ArrowUp":
          e.preventDefault();
          hardDrop();
          break;
        case " ":
          e.preventDefault();
          setIsPaused(p => !p);
          break;
        case "z":
        case "Z":
          e.preventDefault();
          undo();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        isFastDropRef.current = false;
      }
    };

    const handleBlur = () => {
      isFastDropRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [moveLeft, moveRight, moveDown, hardDrop, undo]);

  useEffect(() => {
    if (gameOver || isPaused) {
      isFastDropRef.current = false;
    }
  }, [gameOver, isPaused]);

  // Touch events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (gameOverRef.current || isPausedRef.current) return;
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current || gameOverRef.current || isPausedRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;

      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 200) {
        setIsPaused(p => !p);
        touchStartRef.current = null;
        return;
      }

      if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) moveRight();
          else moveLeft();
        } else {
          if (dy > 30) {
            isFastDropRef.current = true;
            moveDown();
          } else if (dy < -30) {
            hardDrop();
          }
        }
      }

      touchStartRef.current = null;
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [moveLeft, moveRight, moveDown, hardDrop, isPaused]);

  // Auto drop
  useEffect(() => {
    if (gameOver || isPaused || !currentPiece) return;

    const dropInterval = 500;
    const fastDropInterval = 100;
    const interval = setInterval(() => {
      moveDown();
    }, isFastDropRef.current ? fastDropInterval : dropInterval);

    return () => clearInterval(interval);
  }, [gameOver, isPaused, currentPiece, moveDown]);

  // Floating scores animation
  useEffect(() => {
    if (floatingScores.length === 0) return;
    const interval = setInterval(() => {
      setFloatingScores(prev => 
        prev.map(s => ({ ...s, y: s.y - 0.1, life: s.life - 1 })).filter(s => s.life > 0)
      );
    }, 16);
    return () => clearInterval(interval);
  }, [floatingScores.length]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#F7F6F3";
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    ctx.strokeStyle = "#EAEAEA";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, BOARD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(BOARD_WIDTH, y * CELL_SIZE);
      ctx.stroke();
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const value = grid[y][x];
        if (value !== 0) {
          const { bg, text } = getBlockStyle(value);
          ctx.fillStyle = bg;
          const px = x * CELL_SIZE + 1;
          const py = y * CELL_SIZE + 1;
          const size = CELL_SIZE - 2;
          drawRoundRect(ctx, px, py, size, size, 3);
          ctx.fillStyle = text;
          ctx.font = `600 ${value >= 1000 ? 13 : value >= 100 ? 16 : 19}px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(value), x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
        }
      }
    }

    if (currentPiece && !gameOver && !isPaused) {
      const { x, y, value } = currentPiece;
      if (y >= 0 && y < ROWS) {
        const ghostYPos = calculateGhostY(currentPiece, grid);
        if (ghostYPos !== y && ghostYPos >= 0 && ghostYPos < ROWS) {
          const { bg, text } = getBlockStyle(value);
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = bg;
          const px = x * CELL_SIZE + 1;
          const py = ghostYPos * CELL_SIZE + 1;
          const size = CELL_SIZE - 2;
          drawRoundRect(ctx, px, py, size, size, 3);
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = text;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, ghostYPos * CELL_SIZE + CELL_SIZE / 2, size / 2 - 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        const { bg, text } = getBlockStyle(value);
        ctx.fillStyle = bg;
        const px = x * CELL_SIZE + 1;
        const py = y * CELL_SIZE + 1;
        const size = CELL_SIZE - 2;
        drawRoundRect(ctx, px, py, size, size, 3);
        ctx.fillStyle = text;
        ctx.font = `600 ${value >= 1000 ? 13 : value >= 100 ? 16 : 19}px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(value), x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
      }
    }

    for (const fs of floatingScores) {
      ctx.globalAlpha = fs.life / 60;
      ctx.fillStyle = "#9F2F2D";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${fs.value}`, fs.x * CELL_SIZE + CELL_SIZE / 2, fs.y * CELL_SIZE);
    }
    ctx.globalAlpha = 1;

    if (combo > 0 && !gameOver && !isPaused) {
      ctx.fillStyle = "#9F2F2D";
      ctx.font = `700 20px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`×${combo} COMBO`, 8, 8);
    }

    if (gameOver) {
      ctx.fillStyle = "rgba(247, 246, 243, 0.85)";
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      ctx.fillStyle = "#111111";
      ctx.font = `600 28px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Game Over", BOARD_WIDTH / 2, BOARD_HEIGHT / 2 - 32);

      ctx.fillStyle = "#787774";
      ctx.font = `400 15px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
      ctx.fillText(`得分: ${score}`, BOARD_WIDTH / 2, BOARD_HEIGHT / 2);

      if (rank !== null && rank <= 10) {
        ctx.fillStyle = "#956400";
        ctx.font = `600 13px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
        ctx.fillText(`TOP ${rank}`, BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 24);
      }

      if (gameSummary) {
        ctx.fillStyle = "#787774";
        ctx.font = `400 12px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
        ctx.fillText(
          `Lv.${gameSummary.level} · ${gameSummary.totalMerges} 次合并 · 最高连击 ×${gameSummary.maxCombo}`,
          BOARD_WIDTH / 2,
          BOARD_HEIGHT / 2 + 48
        );
        if (gameSummary.isRecord) {
          ctx.fillStyle = "#956400";
          ctx.font = `600 12px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
          ctx.fillText("新纪录", BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 72);
        }
      }

      if (showShareButton) {
        ctx.fillStyle = "#111111";
        ctx.font = `500 12px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
        ctx.fillText("点击右侧按钮分享成绩", BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 96);
      }
    }

    if (isPaused && !gameOver) {
      ctx.fillStyle = "rgba(247, 246, 243, 0.85)";
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      ctx.fillStyle = "#111111";
      ctx.font = `600 24px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Paused", BOARD_WIDTH / 2, BOARD_HEIGHT / 2);
    }
  }, [grid, currentPiece, gameOver, score, isPaused, combo, ghostY, calculateGhostY, rank, floatingScores, showShareButton, gameSummary]);

  const restart = useCallback(() => {
    const newGrid = createEmptyGrid();
    const firstValue = generateRandomValue();
    const nextVal = generateRandomValue();
    const piece = spawnPiece(firstValue);

    setGrid(newGrid);
    setCurrentPiece(piece);
    setNextValue(nextVal);
    setScore(0);
    setGameOver(false);
    setIsPaused(false);
    setCombo(0);
    setRank(null);
    setShowLeaderboard(false);
    setFloatingScores([]);
    setUndoCount(0);
    setShowShareButton(false);
    setGameSummary(null);
    setExperience(0);
    setLevel(1);
    setStats(initialStats);

    currentPieceRef.current = piece;
    nextValueRef.current = nextVal;
    scoreRef.current = 0;
    comboRef.current = 0;
    undoHistoryRef.current = [];
    experienceRef.current = 0;
    levelRef.current = 1;
    statsRef.current = initialStats;
    isFastDropRef.current = false;
    gameStartTimeRef.current = Date.now();
    if (comboTimerRef.current) {
      clearTimeout(comboTimerRef.current);
      comboTimerRef.current = null;
    }
    
  }, []);

  useEffect(() => {
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentLevelExp = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextLevelExp = getExpForNextLevel(level);
  const expProgress = level >= LEVEL_THRESHOLDS.length 
    ? 100 
    : ((experience - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100;

  const startGame = useCallback(() => {
    restart();
  }, [restart]);


  return (
    <main
      className="flex w-full flex-col items-center gap-6 px-4 py-8 select-none"
      style={{ 
        fontFamily: '"SF Pro Display", "Geist Sans", system-ui, sans-serif',
        minHeight: '100vh',
      }}
    >
      {/* Achievement Popup */}
      {achievementPopup && (
        <div
          className="fixed top-6 left-1/2 z-50 px-5 py-3 flex items-center gap-3 rounded-lg pointer-events-none"
          style={{
            background: "#FFFFFF",
            border: "1px solid #EAEAEA",
            boxShadow: "0 10px 30px rgba(45, 42, 36, 0.08)",
            transform: "translateX(-50%)",
            animation: "slideIn 0.3s ease-out forwards",
          }}
        >
          <span
            className="flex h-[30px] w-[30px] items-center justify-center text-[10px] font-semibold tracking-[0.08em]"
            style={{ background: "#F7F6F3", border: "1px solid #EAEAEA", borderRadius: "6px", color: "#956400" }}
          >
            ACH
          </span>
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-[#787774] font-medium">成就解锁</div>
            <div className="text-[14px] font-semibold text-[#111111]">{achievementPopup.name}</div>
            <div className="text-[11px] text-[#787774]">{achievementPopup.description}</div>
          </div>
        </div>
      )}

      {/* Header - Title + Level + Score */}
      <div className="flex w-full max-w-[760px] items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111111]">数字消除方块</h1>
            <p className="text-[12px] text-[#787774] tracking-wide">相邻三个相同数字自动合并</p>
          </div>
          <button
            onClick={() => setShowAchievements(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-[#F7F6F3]"
            style={{ border: "1px solid #E5E5E5" }}
          >
            <span className="text-[14px]">🏆</span>
            <span className="text-[12px] font-medium text-[#111111]">成就</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#F7F6F3", color: "#787774" }}>
              {unlockedAchievements.length}/{ACHIEVEMENTS.length}
            </span>
          </button>
        </div>
        
        {/* Level Progress - Center */}
        <div className="flex-1 max-w-[300px] px-4">
          <div className="flex justify-between items-center mb-1">
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] font-medium">Lv.{level}</div>
            <div className="text-[10px] text-[#787774] tabular-nums">{experience} / {nextLevelExp}</div>
          </div>
          <div className="relative h-[8px] rounded-full overflow-hidden" style={{ background: "#F0F0F0" }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.min(expProgress, 100)}%`,
                background: "linear-gradient(90deg, #956400, #D4A574)",
              }}
            />
            {expProgress > 0 && (
              <div 
                className="absolute top-0 h-full w-[30%] rounded-full"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                  animation: "progressShine 2s ease-in-out infinite",
                }}
              />
            )}
          </div>
        </div>

        {/* Score - Right */}
        <div className="flex flex-col items-end">
          <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] font-medium">得分</div>
          <div 
            className="text-[28px] font-bold tracking-[-0.03em] tabular-nums transition-all duration-200"
            style={{ 
              color: combo > 0 ? "#9F2F2D" : "#111111",
            }}
          >
            {score}
          </div>
          {combo > 0 && !gameOver && (
            <div 
              className="text-[11px] font-semibold px-2 py-0.5 mt-1"
              style={{ 
                background: "linear-gradient(135deg, #FDEBEC, #FFE8E0)", 
                color: "#9F2F2D", 
                borderRadius: "4px",
                animation: "comboFlash 1s ease-in-out infinite",
              }}
            >
              🔥 连击 ×{combo}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Left Sidebar + Canvas + Right Sidebar */}
      <div className="flex w-full max-w-[760px] items-start justify-center gap-4">
        {/* Left Sidebar - Stats & Achievements */}
        <aside className="flex w-[180px] shrink-0 flex-col gap-3">
          {/* Statistics */}
          <div
            className="panel-card cursor-pointer"
            style={{ background: showStats ? "#F7F6F3" : "#FFFFFF" }}
            onClick={() => setShowStats(!showStats)}
          >
            <div className="flex justify-between items-center mb-2">
              <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] font-medium">统计</div>
              <div className="text-[10px] text-[#787774]">{showStats ? "▲" : "▼"}</div>
            </div>
            {showStats ? (
              <div className="flex flex-col gap-1.5">
                {[
                  ["游戏时间", formatTime(stats.gameTime)],
                  ["放置方块", String(stats.totalPieces)],
                  ["合并次数", String(stats.totalMerges)],
                  ["最高连击", `×${stats.maxCombo}`],
                  ["最大合并", `${stats.biggestMerge} 格`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-[11px]">
                    <span className="text-[#787774]">{label}</span>
                    <span className="font-medium text-[#111111] tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-[#787774]">点击展开</div>
            )}
          </div>

          {/* Achievements */}
          <div
            className="panel-card cursor-pointer"
            onClick={() => setShowAchievements(true)}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] font-medium">成就</div>
              <div className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#F7F6F3", color: "#787774" }}>
                {unlockedAchievements.length}/{ACHIEVEMENTS.length}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ACHIEVEMENTS.map((a) => (
                <div
                  key={a.id}
                  className="w-[28px] h-[28px] flex items-center justify-center rounded-lg transition-all duration-200"
                  style={{
                    background: unlockedAchievements.includes(a.id)
                      ? "linear-gradient(135deg, #FBF3DB, #F5E6C8)"
                      : "#F7F6F3",
                    border: `1px solid ${unlockedAchievements.includes(a.id) ? "#E5D4A5" : "#EAEAEA"}`,
                    fontSize: "14px",
                    opacity: unlockedAchievements.includes(a.id) ? 1 : 0.4,
                    cursor: "pointer",
                    boxShadow: unlockedAchievements.includes(a.id) ? "0 2px 4px rgba(0,0,0,0.08)" : "none",
                  }}
                  title={a.name}
                >
                  {unlockedAchievements.includes(a.id) ? a.icon : "🔒"}
                </div>
              ))}
            </div>
            <div className="text-[10px] text-[#787774] mt-2 text-center">點擊查看完整圖鑑</div>
          </div>
        </aside>

        {/* Canvas */}
        <div className="relative w-[302px] shrink-0 canvas-container" style={{ borderRadius: "12px" }}>
          <canvas
            ref={canvasRef}
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            className="block"
            style={{
              borderRadius: "12px",
              border: "1px solid #E5E5E5",
              background: "#FAFAFA",
            }}
            tabIndex={0}
          />
        </div>

        {/* Right Sidebar */}
        <aside className="flex w-[200px] shrink-0 flex-col gap-3">
          {/* Next */}
          <div className="panel-card">
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] mb-3 font-medium">下一个</div>
            <div className="flex justify-center">
              <div 
                className="w-[48px] h-[48px] flex items-center justify-center font-semibold text-[16px]"
                style={{ 
                  background: getBlockStyle(nextValue).bg, 
                  color: getBlockStyle(nextValue).text, 
                  borderRadius: "8px", 
                  border: "1px solid #E5E5E5",
                  animation: "breathe 2s ease-in-out infinite",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              >
                {nextValue}
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div 
            className="panel-card cursor-pointer"
            style={{ background: showLeaderboard ? "#F7F6F3" : "#FFFFFF" }}
            onClick={() => setShowLeaderboard(!showLeaderboard)}
          >
            <div className="flex justify-between items-center mb-2">
              <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] font-medium">排行榜</div>
              <div className="text-[10px] text-[#787774]">{showLeaderboard ? "▲" : "▼"}</div>
            </div>
            {showLeaderboard ? (
              <div className="flex flex-col gap-1">
                {leaderboard.length === 0 ? (
                  <div className="text-[11px] text-[#AAA] py-2 text-center">暂无记录</div>
                ) : (
                  leaderboard.slice(0, 5).map((entry, i) => (
                    <div key={i} className="flex justify-between text-[11px] py-1"
                      style={{ color: i === 0 ? "#956400" : i === 1 ? "#787774" : i === 2 ? "#8B3A1A" : "#AAA" }}>
                      <span className="font-medium">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                      <span className="tabular-nums">{entry.score}</span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-[11px] text-[#787774]">{leaderboard.length > 0 ? `最高: ${leaderboard[0].score}` : "点击展开"}</div>
            )}
          </div>

          {/* Controls */}
          <div className="panel-card">
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] mb-3 font-medium">操作</div>
            <div className="flex flex-col gap-2">
              {[
                ["← →", "左右移动"],
                ["↓", "加速下落"],
                ["↑", "直接落底"],
                ["Space", "暂停 / 继续"],
                ["Z", "撤销"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="key-badge">{key}</span>
                  <span className="text-[12px] text-[#787774]">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2">
            <div className="min-h-[40px]">
              {showShareButton && (
                <button onClick={shareScore}
                  className="w-full py-2.5 text-[13px] font-medium rounded-lg btn-hover"
                  style={{ background: "#956400", color: "#FFFFFF", border: "none" }}>
                  分享成绩
                </button>
              )}
            </div>
            <button onClick={restart}
              className="w-full py-2.5 text-[13px] font-medium rounded-lg btn-hover"
              style={{ background: "#111111", color: "#FFFFFF", border: "none" }}>
              重新开始
            </button>
            <button onClick={() => setIsPaused(p => !p)} disabled={gameOver}
              className="w-full py-2.5 text-[13px] font-medium rounded-lg btn-hover"
              style={{ 
                background: gameOver ? "#F7F6F3" : "#FFFFFF", 
                color: gameOver ? "#AAA" : "#111111", 
                border: "1px solid #E5E5E5" 
              }}>
              {isPaused ? "继续" : "暂停"}
            </button>
          </div>
        </aside>
      </div>

      {/* Game Rules */}
      <div className="w-full max-w-[760px] mt-4">
        <div
          className="panel-card cursor-pointer"
          style={{ background: showRules ? "#F7F6F3" : "#FFFFFF" }}
          onClick={() => setShowRules(!showRules)}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] font-medium">遊戲規則</div>
            <div className="text-[10px] text-[#787774]">{showRules ? "▲" : "▼"}</div>
          </div>
          {showRules ? (
            <div className="flex flex-col gap-4 text-[12px]">
              <div>
                <div className="font-semibold mb-1.5 text-[#111111]">遊戲目標</div>
                <div className="text-[#787774] leading-relaxed">放置數字方塊，讓相鄰三個相同數字自動合併，獲得更高分數，挑戰最高分並解鎖成就。</div>
              </div>

              <div>
                <div className="font-semibold mb-1.5 text-[#111111]">合併規則</div>
                <div className="text-[#787774] leading-relaxed mb-2">當三個或更多相同數字在水平或垂直方向相鄰時，會自動合併成更大的數字。</div>
                <div className="bg-[#F7F6F3] rounded-lg p-3 text-[11px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center justify-center w-[24px] h-[24px] rounded text-[10px] font-semibold" style={{ background: getBlockStyle(2).bg, color: getBlockStyle(2).text }}>2</span>
                    <span className="text-[#787774]">+</span>
                    <span className="inline-flex items-center justify-center w-[24px] h-[24px] rounded text-[10px] font-semibold" style={{ background: getBlockStyle(2).bg, color: getBlockStyle(2).text }}>2</span>
                    <span className="text-[#787774]">+</span>
                    <span className="inline-flex items-center justify-center w-[24px] h-[24px] rounded text-[10px] font-semibold" style={{ background: getBlockStyle(2).bg, color: getBlockStyle(2).text }}>2</span>
                    <span className="text-[#787774]">=</span>
                    <span className="inline-flex items-center justify-center w-[24px] h-[24px] rounded text-[10px] font-semibold" style={{ background: getBlockStyle(6).bg, color: getBlockStyle(6).text }}>6</span>
                  </div>
                  <div className="text-[#AAA] text-[10px]">三個 2 合併成一個 6（3 × 2 = 6）</div>
                </div>
              </div>

              <div>
                <div className="font-semibold mb-1.5 text-[#111111]">連擊系統</div>
                <div className="text-[#787774] leading-relaxed">連續成功合併會累積連擊數，連擊數越高額外加成越多。3 秒內沒有合併，連擊數會重置。</div>
              </div>

              <div>
                <div className="font-semibold mb-1.5 text-[#111111]">等級系統</div>
                <div className="text-[#787774] leading-relaxed">每次合併獲得經驗值，經驗值達到一定數量會提升等級。</div>
              </div>

              <div>
                <div className="font-semibold mb-1.5 text-[#111111]">遊戲結束</div>
                <div className="text-[#787774] leading-relaxed">當方塊堆到頂部無法放置新方塊時遊戲結束。</div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-[#787774]">點擊展開遊戲規則</div>
          )}
        </div>
      </div>

      {/* Achievements Modal */}
      {showAchievements && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl p-6 max-w-[600px] w-full mx-4 max-h-[80vh] overflow-y-auto" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-[20px] font-semibold text-[#111111]">成就圖鑑</h2>
                <p className="text-[12px] text-[#787774]">已解鎖 {unlockedAchievements.length}/{ACHIEVEMENTS.length}</p>
              </div>
              <button onClick={() => setShowAchievements(false)} className="w-[32px] h-[32px] flex items-center justify-center rounded-lg hover:bg-[#F7F6F3] transition-colors text-[#787774] hover:text-[#111111]">
                ✕
              </button>
            </div>

            {/* Progress Overview */}
            <div className="mb-6 p-4 rounded-xl" style={{ background: "linear-gradient(135deg, #FBF3DB, #F5E6C8)", border: "1px solid #E5D4A5" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-[#111111]">整體進度</span>
                <span className="text-[12px] font-semibold text-[#956400]">{Math.round((unlockedAchievements.length / ACHIEVEMENTS.length) * 100)}%</span>
              </div>
              <div className="h-[8px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.5)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(unlockedAchievements.length / ACHIEVEMENTS.length) * 100}%`,
                    background: "linear-gradient(90deg, #956400, #D4A574)",
                  }}
                />
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 gap-4">
              {ACHIEVEMENTS.map((achievement) => {
                const isUnlocked = unlockedAchievements.includes(achievement.id);
                const currentProgress = achievement.progress(stats);
                const progressPercent = Math.min((currentProgress / achievement.target) * 100, 100);

                return (
                  <div
                    key={achievement.id}
                    className="rounded-xl p-4 transition-all"
                    style={{
                      background: isUnlocked ? "linear-gradient(135deg, #FBF3DB, #F5E6C8)" : "#F7F6F3",
                      border: `1px solid ${isUnlocked ? "#E5D4A5" : "#EAEAEA"}`,
                      opacity: isUnlocked ? 1 : 0.6,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-[48px] h-[48px] flex items-center justify-center rounded-lg text-[24px] shrink-0"
                        style={{
                          background: isUnlocked ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.05)",
                        }}
                      >
                        {isUnlocked ? achievement.icon : "🔒"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold text-[#111111] truncate">{achievement.name}</div>
                        <div className="text-[11px] text-[#787774] mb-2 line-clamp-2">{achievement.description}</div>

                        {/* Progress Bar */}
                        <div className="h-[4px] rounded-full overflow-hidden" style={{ background: "#EAEAEA" }}>
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${progressPercent}%`,
                              background: isUnlocked ? "linear-gradient(90deg, #956400, #D4A574)" : "#AAA",
                            }}
                          />
                        </div>
                        <div className="text-[10px] text-[#787774] mt-1 tabular-nums">
                          {currentProgress.toLocaleString()}/{achievement.target.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>

  );
}
