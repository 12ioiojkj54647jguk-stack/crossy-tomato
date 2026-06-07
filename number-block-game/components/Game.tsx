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

const CELL_SIZE = 30;
const BOARD_WIDTH = COLS * CELL_SIZE;
const BOARD_HEIGHT = ROWS * CELL_SIZE;



// Level thresholds (experience needed for each level)
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000];

function getLevel(exp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (exp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function getExpForNextLevel(level: number): number {
  return LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] * 2;
}



// Muted pastel palette for number blocks
const VALUE_COLORS: Record<number, { bg: string; text: string }> = {
  2:     { bg: "#F5F0EB", text: "#6B5B4F" },
  4:     { bg: "#EDE8E1", text: "#5E4E42" },
  8:     { bg: "#FDEBEC", text: "#9F2F2D" },
  16:    { bg: "#E1F3FE", text: "#1F6C9F" },
  32:    { bg: "#EDF3EC", text: "#346538" },
  64:    { bg: "#FBF3DB", text: "#956400" },
  128:   { bg: "#F0E6FF", text: "#5B2D8E" },
  256:   { bg: "#FFE8E0", text: "#8B3A1A" },
  512:   { bg: "#E0F7F0", text: "#1A6B5A" },
  1024:  { bg: "#E6E0FF", text: "#3D2D6B" },
  2048:  { bg: "#FFE0F0", text: "#6B1A4A" },
};

function getBlockStyle(value: number) {
  return VALUE_COLORS[value] || { bg: "#111111", text: "#FFFFFF" };
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

// Leaderboard helpers
interface LeaderboardEntry {
  score: number;
  date: string;
}

function loadLeaderboard(): LeaderboardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("number-block-leaderboard");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(entries: LeaderboardEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("number-block-leaderboard", JSON.stringify(entries));
}

function addToLeaderboard(score: number): LeaderboardEntry[] {
  const entries = loadLeaderboard();
  const newEntry: LeaderboardEntry = {
    score,
    date: new Date().toLocaleDateString("zh-CN"),
  };
  entries.push(newEntry);
  entries.sort((a, b) => b.score - a.score);
  const trimmed = entries.slice(0, 10);
  saveLeaderboard(trimmed);
  return trimmed;
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
  
  // Level system
  const [experience, setExperience] = useState(0);
  const [level, setLevel] = useState(1);

  const gridRef = useRef(grid);
  const currentPieceRef = useRef(currentPiece);
  const nextValueRef = useRef(nextValue);
  const gameOverRef = useRef(gameOver);
  const isPausedRef = useRef(isPaused);
  const isFastDropRef = useRef(false);
  const comboRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoHistoryRef = useRef<GameState[]>([]);
  const experienceRef = useRef(0);
  const levelRef = useRef(1);

  // Touch state
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { currentPieceRef.current = currentPiece; }, [currentPiece]);
  useEffect(() => { nextValueRef.current = nextValue; }, [nextValue]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { experienceRef.current = experience; }, [experience]);
  useEffect(() => { levelRef.current = level; }, [level]);

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

  // Save state for undo
  const saveStateForUndo = useCallback(() => {
    const state: GameState = {
      grid: gridRef.current.map(row => [...row]),
      score: score,
      combo: comboRef.current,
      nextValue: nextValueRef.current,
    };
    undoHistoryRef.current.push(state);
    if (undoHistoryRef.current.length > 3) {
      undoHistoryRef.current.shift();
    }
    setUndoCount(undoHistoryRef.current.length);
  }, [score]);

  // Undo function
  const undo = useCallback(() => {
    if (undoHistoryRef.current.length === 0 || gameOverRef.current || isPausedRef.current) return;
    const state = undoHistoryRef.current.pop()!;
    setGrid(state.grid);
    setScore(state.score);
    setCombo(state.combo);
    setNextValue(state.nextValue);
    setUndoCount(undoHistoryRef.current.length);
    
    const piece = spawnPiece(state.nextValue);
    if (isValidMove(state.grid, piece.x, piece.y)) {
      setCurrentPiece(piece);
      currentPieceRef.current = piece;
    }
  }, []);

  const lockPiece = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece) return;

    saveStateForUndo();

    const newGrid = currentGrid.map(row => [...row]);

    if (piece.y < 0 || piece.y >= ROWS || piece.x < 0 || piece.x >= COLS || newGrid[piece.y][piece.x] !== 0) {
      setGameOver(true);
      setCurrentPiece(null);
      setShowShareButton(true);
      return;
    }

    newGrid[piece.y][piece.x] = piece.value;

    if (piece.y === 0) {
      setGrid(newGrid);
      setGameOver(true);
      setCurrentPiece(null);
      setShowShareButton(true);
      return;
    }

    const result = stabilize(newGrid);
    
    const mergeCount = result.scoreGained > 0 ? Math.max(1, Math.round(result.scoreGained / 10 / piece.value)) : 0;
    
    // Calculate experience gained
    const baseExp = piece.value; // Base exp from piece value
    const mergeBonusExp = mergeCount * 15; // Bonus for merges
    const comboBonusExp = Math.min(comboRef.current, 5) * 5; // Combo bonus
    const totalExp = baseExp + mergeBonusExp + comboBonusExp;
    addExperience(totalExp);
    
    // Update combo if merges happened
    if (mergeCount > 0) {
      setCombo(prev => prev + mergeCount);
      resetComboTimer();
    }

    // Calculate combo multiplier
    const comboMultiplier = Math.min(comboRef.current, 10);
    const finalScore = result.scoreGained * (1 + comboMultiplier * 0.5);
    
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
    setScore(prev => prev + Math.round(finalScore));

    if (checkGameOver(result.grid)) {
      setGameOver(true);
      setCurrentPiece(null);
      const newLeaderboard = addToLeaderboard(score + Math.round(finalScore));
      setLeaderboard(newLeaderboard);
      const playerRank = newLeaderboard.findIndex(e => e.score === (score + Math.round(finalScore))) + 1;
      if (playerRank > 0) setRank(playerRank);
      setShowShareButton(true);
      return;
    }

    const newPiece = spawnPiece(nextValueRef.current);
    if (!isValidMove(result.grid, newPiece.x, newPiece.y)) {
      setGameOver(true);
      setCurrentPiece(null);
      const newLeaderboard = addToLeaderboard(score + Math.round(finalScore));
      setLeaderboard(newLeaderboard);
      const playerRank = newLeaderboard.findIndex(e => e.score === (score + Math.round(finalScore))) + 1;
      if (playerRank > 0) setRank(playerRank);
      setShowShareButton(true);
      return;
    }

    setCurrentPiece(newPiece);
    const newNext = generateRandomValue();
    setNextValue(newNext);
    nextValueRef.current = newNext;
  }, [resetComboTimer, score, saveStateForUndo, addExperience]);

  const moveDown = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    const newY = piece.y + 1;
    if (isValidMove(currentGrid, piece.x, newY)) {
      setCurrentPiece({ ...piece, y: newY });
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
      setCurrentPiece({ ...piece, x: newX });
    }
  }, []);

  const moveRight = useCallback(() => {
    const piece = currentPieceRef.current;
    const currentGrid = gridRef.current;
    if (!piece || gameOverRef.current || isPausedRef.current) return;

    const newX = piece.x + 1;
    if (isValidMove(currentGrid, newX, piece.y)) {
      setCurrentPiece({ ...piece, x: newX });
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
    if (currentPieceRef.current) {
      const piece = currentPieceRef.current;
      const currentGrid = gridRef.current;
      const newGrid = currentGrid.map(row => [...row]);
      if (piece.y >= 0 && piece.y < ROWS && piece.x >= 0 && piece.x < COLS && newGrid[piece.y][piece.x] === 0) {
        newGrid[piece.y][piece.x] = piece.value;
        const result = stabilize(newGrid);
        setGrid(result.grid);
        setScore(prev => prev + result.scoreGained);
      }
    }
    setCurrentPiece(null);
    setGameOver(true);
    setShowShareButton(true);
    const newLeaderboard = addToLeaderboard(score);
    setLeaderboard(newLeaderboard);
    const playerRank = newLeaderboard.findIndex(e => e.score === score) + 1;
    if (playerRank > 0) setRank(playerRank);
  }, [score]);

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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [moveLeft, moveRight, moveDown, hardDrop, undo]);

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
        ctx.fillStyle = "#9F2F2D";
        ctx.font = `600 13px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
        ctx.fillText(`🏆 排名第 ${rank}`, BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 24);
      }

      if (showShareButton) {
        ctx.fillStyle = "#111111";
        ctx.font = `500 12px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
        ctx.fillText("點擊分享按鈕分享成績", BOARD_WIDTH / 2, BOARD_HEIGHT / 2 + 52);
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
  }, [grid, currentPiece, gameOver, score, isPaused, combo, ghostY, calculateGhostY, rank, floatingScores, showShareButton]);

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
    setExperience(0);
    setLevel(1);

    currentPieceRef.current = piece;
    nextValueRef.current = nextVal;
    comboRef.current = 0;
    undoHistoryRef.current = [];
    experienceRef.current = 0;
    levelRef.current = 1;
    
  }, []);

  useEffect(() => {
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGame = useCallback(() => {
    restart();
  }, [restart]);

  const currentLevelExp = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextLevelExp = getExpForNextLevel(level);
  const expProgress = level >= LEVEL_THRESHOLDS.length 
    ? 100 
    : ((experience - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100;

  return (
    <div
      className="flex flex-col items-center gap-8 select-none"
      style={{ fontFamily: '"SF Pro Display", "Geist Sans", system-ui, sans-serif' }}
    >

      <div className="flex flex-col items-center gap-1">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111111]">数字消除方块</h1>
        <p className="text-[12px] text-[#787774] tracking-wide">相邻三个相同数字自动合并</p>
      </div>

      <div className="flex gap-8 items-start">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            className="block"
            style={{ borderRadius: "8px", border: "1px solid #EAEAEA", background: "#F7F6F3" }}
            tabIndex={0}
          />
        </div>

        <div className="flex flex-col gap-4 min-w-[160px]">
          {/* Level */}
          <div className="p-5" style={{ background: "#FFFFFF", border: "1px solid #EAEAEA", borderRadius: "8px" }}>
            <div className="flex justify-between items-center mb-2">
              <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] font-medium">等級</div>
              <div className="text-[18px] font-bold text-[#1F6C9F]">Lv.{level}</div>
            </div>
            <div className="h-[6px] rounded-full overflow-hidden" style={{ background: "#EAEAEA" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(expProgress, 100)}%`,
                  background: "linear-gradient(90deg, #1F6C9F, #346538)",
                }}
              />
            </div>
            <div className="text-[10px] text-[#787774] mt-1 text-right">{experience} / {nextLevelExp} EXP</div>
          </div>

          {/* Score */}
          <div className="p-5" style={{ background: "#FFFFFF", border: "1px solid #EAEAEA", borderRadius: "8px" }}>
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] mb-2 font-medium">得分</div>
            <div className="text-[28px] font-semibold tracking-[-0.03em] text-[#111111] tabular-nums">{score}</div>
            {combo > 0 && !gameOver && (
              <div className="mt-2 text-[11px] font-semibold px-2 py-1 inline-block"
                style={{ background: "#FDEBEC", color: "#9F2F2D", borderRadius: "4px" }}>
                🔥 连击 ×{combo}
              </div>
            )}
            {undoCount > 0 && !gameOver && (
              <div className="mt-1 text-[10px] px-2 py-1 inline-block"
                style={{ background: "#E1F3FE", color: "#1F6C9F", borderRadius: "4px" }}>
                ↩️ 可撤销 {undoCount}/3
              </div>
            )}
          </div>

          {/* Next */}
          <div className="p-5" style={{ background: "#FFFFFF", border: "1px solid #EAEAEA", borderRadius: "8px" }}>
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] mb-3 font-medium">下一个</div>
            <div className="flex justify-center">
              <div className="w-[44px] h-[44px] flex items-center justify-center font-semibold text-[15px]"
                style={{ background: getBlockStyle(nextValue).bg, color: getBlockStyle(nextValue).text, borderRadius: "6px", border: "1px solid #EAEAEA" }}>
                {nextValue}
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="p-5 cursor-pointer transition-all duration-200"
            style={{ background: showLeaderboard ? "#F7F6F3" : "#FFFFFF", border: "1px solid #EAEAEA", borderRadius: "8px" }}
            onClick={() => setShowLeaderboard(!showLeaderboard)}>
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
          <div className="px-5 py-4" style={{ background: "#FFFFFF", border: "1px solid #EAEAEA", borderRadius: "8px" }}>
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
                  <span className="inline-flex items-center justify-center min-w-[28px] h-[22px] px-1.5 text-[10px] font-medium"
                    style={{ background: "#F7F6F3", border: "1px solid #EAEAEA", borderRadius: "4px", color: "#555", fontFamily: '"SF Mono", "Geist Mono", monospace' }}>
                    {key}
                  </span>
                  <span className="text-[12px] text-[#787774]">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2">
            {showShareButton && (
              <button onClick={shareScore}
                className="w-full py-2.5 px-4 text-[13px] font-medium transition-all duration-200"
                style={{ background: "#1F6C9F", color: "#FFFFFF", borderRadius: "6px", border: "none", cursor: "pointer" }}>
                📤 分享成绩
              </button>
            )}
            <button onClick={endGame} disabled={gameOver}
              className="w-full py-2.5 px-4 text-[13px] font-medium transition-all duration-200"
              style={{ background: gameOver ? "#EAEAEA" : "#111111", color: gameOver ? "#AAA" : "#FFFFFF", borderRadius: "6px", border: "none", cursor: gameOver ? "default" : "pointer" }}>
              结束游戏
            </button>
            <button onClick={restart}
              className="w-full py-2.5 px-4 text-[13px] font-medium transition-all duration-200"
              style={{ background: "#F7F6F3", color: "#111111", borderRadius: "6px", border: "1px solid #EAEAEA", cursor: "pointer" }}>
              重新开始
            </button>
            <button onClick={() => setIsPaused(p => !p)} disabled={gameOver}
              className="w-full py-2.5 px-4 text-[13px] font-medium transition-all duration-200"
              style={{ background: gameOver ? "#F7F6F3" : "#FFFFFF", color: gameOver ? "#AAA" : "#111111", borderRadius: "6px", border: "1px solid #EAEAEA", cursor: gameOver ? "default" : "pointer" }}>
              {isPaused ? "继续" : "暂停"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
