"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  COLS,
  ROWS,
  createEmptyGrid,
  generateRandomValue,
  generateSpecialValue,
  spawnPiece,
  isValidMove,
  stabilize,
  checkGameOver,
  applyBomb,
  type Grid,
  type Piece,
  type Position,
} from "@/lib/gameEngine";

const CELL_SIZE = 30;
const BOARD_WIDTH = COLS * CELL_SIZE;
const BOARD_HEIGHT = ROWS * CELL_SIZE;

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
  // Special blocks
  0:     { bg: "#333333", text: "#FFFFFF" },  // Bomb
  [-1]:  { bg: "#E1F3FE", text: "#1F6C9F" },  // Ice
};

function getBlockStyle(value: number) {
  return VALUE_COLORS[value] || { bg: "#111111", text: "#FFFFFF" };
}

function getBlockDisplay(value: number): string {
  if (value === 0) return "💣";
  if (value === -1) return "❄️";
  return String(value);
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

// Particle system
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
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
  
  // New features state
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingScores, setFloatingScores] = useState<{ x: number; y: number; value: number; life: number }[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [isFrozen, setIsFrozen] = useState(false);
  const [showShareButton, setShowShareButton] = useState(false);

  const gridRef = useRef(grid);
  const currentPieceRef = useRef(currentPiece);
  const nextValueRef = useRef(nextValue);
  const gameOverRef = useRef(gameOver);
  const isPausedRef = useRef(isPaused);
  const isFastDropRef = useRef(false);
  const comboRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoHistoryRef = useRef<GameState[]>([]);
  const isFrozenRef = useRef(false);
  const frozenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pieceCountRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Touch state
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { currentPieceRef.current = currentPiece; }, [currentPiece]);
  useEffect(() => { nextValueRef.current = nextValue; }, [nextValue]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { isFrozenRef.current = isFrozen; }, [isFrozen]);

  // Load leaderboard on mount
  useEffect(() => {
    setLeaderboard(loadLeaderboard());
  }, []);

  // Particle animation loop
  useEffect(() => {
    const animate = () => {
      if (particlesRef.current.length > 0) {
        particlesRef.current = particlesRef.current
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.3, // gravity
            life: p.life - 1,
            size: p.size * 0.97,
          }))
          .filter(p => p.life > 0);
        setParticles([...particlesRef.current]);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Spawn particles at position
  const spawnParticles = useCallback((x: number, y: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      newParticles.push({
        x: x * CELL_SIZE + CELL_SIZE / 2,
        y: y * CELL_SIZE + CELL_SIZE / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 40 + Math.random() * 20,
        color,
        size: 4 + Math.random() * 3,
      });
    }
    particlesRef.current = [...particlesRef.current, ...newParticles].slice(-50);
    setParticles([...particlesRef.current]);
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
    
    // Spawn piece from saved next value
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

    // Save state before locking
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

    // Handle special blocks
    if (piece.value === 0) {
      // Bomb: clear 3x3 area
      const cleared = applyBomb(newGrid, piece.x, piece.y);
      const result = stabilize(newGrid);
      setGrid(result.grid);
      setScore(prev => prev + result.scoreGained + cleared.length * 5);
      
      // Spawn particles for bomb
      spawnParticles(piece.x, piece.y, "#9F2F2D");
      for (const pos of cleared) {
        spawnParticles(pos.x, pos.y, "#F2B179");
      }
      
      setShowShareButton(true);
      setCurrentPiece(null);
      setGameOver(true);
      return;
    }

    if (piece.value === -1) {
      // Ice: freeze gravity for 3 seconds
      newGrid[piece.y][piece.x] = -1;
      setGrid(newGrid);
      setIsFrozen(true);
      
      if (frozenTimerRef.current) clearTimeout(frozenTimerRef.current);
      frozenTimerRef.current = setTimeout(() => {
        setIsFrozen(false);
      }, 3000);
      
      // Continue with next piece
      const newPiece = spawnPiece(nextValueRef.current);
      if (!isValidMove(newGrid, newPiece.x, newPiece.y)) {
        setGameOver(true);
        setCurrentPiece(null);
        setShowShareButton(true);
        return;
      }
      setCurrentPiece(newPiece);
      const newNext = generateRandomValue();
      setNextValue(newNext);
      nextValueRef.current = newNext;
      pieceCountRef.current++;
      return;
    }

    const result = stabilize(newGrid);
    
    // Spawn particles for merges
    if (result.mergePositions.length > 0) {
      const { text } = getBlockStyle(piece.value);
      for (const pos of result.mergePositions.slice(0, 5)) {
        spawnParticles(pos.x, pos.y, text);
      }
    }

    const mergeCount = result.scoreGained > 0 ? Math.max(1, Math.round(result.scoreGained / 10 / piece.value)) : 0;
    
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

    // Generate next piece (with chance for special)
    pieceCountRef.current++;
    let newNextValue: number;
    if (pieceCountRef.current % 10 === 0) {
      newNextValue = generateSpecialValue();
    } else {
      newNextValue = generateRandomValue();
    }
    
    const newPiece = spawnPiece(newNextValue);
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
    setNextValue(newNextValue);
    nextValueRef.current = newNextValue;
  }, [resetComboTimer, score, saveStateForUndo, spawnParticles]);

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

  // 结束游戏
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
        spawnParticles(piece.x, piece.y, getBlockStyle(piece.value).text);
      }
    }
    setCurrentPiece(null);
    setGameOver(true);
    setShowShareButton(true);
    // Add to leaderboard
    const newLeaderboard = addToLeaderboard(score);
    setLeaderboard(newLeaderboard);
    const playerRank = newLeaderboard.findIndex(e => e.score === score) + 1;
    if (playerRank > 0) setRank(playerRank);
  }, [score, spawnParticles]);

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

      // Tap (for pause)
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 200) {
        setIsPaused(p => !p);
        touchStartRef.current = null;
        return;
      }

      // Swipe
      if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal
          if (dx > 0) moveRight();
          else moveLeft();
        } else {
          // Vertical
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

  // Auto drop (with freeze support)
  useEffect(() => {
    if (gameOver || isPaused || !currentPiece || isFrozen) return;

    const interval = setInterval(() => {
      moveDown();
    }, isFastDropRef.current ? 100 : 500);

    return () => clearInterval(interval);
  }, [gameOver, isPaused, currentPiece, moveDown, isFrozen]);

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

  // Canvas 渲染
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 背景 - 暖白
    ctx.fillStyle = isFrozen ? "#E8F4FD" : "#F7F6F3";
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // 網格線 - 極淡
    ctx.strokeStyle = isFrozen ? "#B8D4E8" : "#EAEAEA";
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

    // 冰凍效果邊框
    if (isFrozen) {
      ctx.strokeStyle = "#1F6C9F";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, BOARD_WIDTH - 4, BOARD_HEIGHT - 4);
    }

    // 方塊
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
          
          // Draw emoji or number
          if (value === 0 || value === -1) {
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(getBlockDisplay(value), x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
          } else {
            ctx.fillStyle = text;
            ctx.font = `600 ${value >= 1000 ? 13 : value >= 100 ? 16 : 19}px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(value), x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
          }
        }
      }
    }

    // Ghost piece (projection)
    if (currentPiece && !gameOver && !isPaused && currentPiece.value > 0) {
      const { x, value } = currentPiece;
      const ghostYPos = calculateGhostY(currentPiece, grid);
      if (ghostYPos !== currentPiece.y && ghostYPos >= 0 && ghostYPos < ROWS) {
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
    }

    // Current falling piece
    if (currentPiece) {
      const { x, y, value } = currentPiece;
      if (y >= 0 && y < ROWS) {
        const { bg, text } = getBlockStyle(value);
        ctx.fillStyle = bg;
        const px = x * CELL_SIZE + 1;
        const py = y * CELL_SIZE + 1;
        const size = CELL_SIZE - 2;
        drawRoundRect(ctx, px, py, size, size, 3);
        
        if (value === 0 || value === -1) {
          ctx.font = "14px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(getBlockDisplay(value), x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
        } else {
          ctx.fillStyle = text;
          ctx.font = `600 ${value >= 1000 ? 13 : value >= 100 ? 16 : 19}px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(value), x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
        }
      }
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life / 60;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Floating scores
    for (const fs of floatingScores) {
      ctx.globalAlpha = fs.life / 60;
      ctx.fillStyle = "#9F2F2D";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`+${fs.value}`, fs.x * CELL_SIZE + CELL_SIZE / 2, fs.y * CELL_SIZE);
    }
    ctx.globalAlpha = 1;

    // Combo display on canvas
    if (combo > 0 && !gameOver && !isPaused) {
      ctx.fillStyle = "#9F2F2D";
      ctx.font = `700 20px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`×${combo} COMBO`, 8, 8);
    }

    // Frozen indicator
    if (isFrozen && !gameOver && !isPaused) {
      ctx.fillStyle = "#1F6C9F";
      ctx.font = `600 12px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText("❄️ 冰凍中", BOARD_WIDTH - 8, 8);
    }

    // Game Over overlay
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

    // Pause overlay
    if (isPaused && !gameOver) {
      ctx.fillStyle = "rgba(247, 246, 243, 0.85)";
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      ctx.fillStyle = "#111111";
      ctx.font = `600 24px "SF Pro Display", "Geist Sans", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Paused", BOARD_WIDTH / 2, BOARD_HEIGHT / 2);
    }
  }, [grid, currentPiece, gameOver, score, isPaused, combo, ghostY, calculateGhostY, rank, particles, floatingScores, isFrozen, showShareButton]);

  // Restart
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
    setParticles([]);
    setFloatingScores([]);
    setUndoCount(0);
    setShowShareButton(false);
    setIsFrozen(false);

    currentPieceRef.current = piece;
    nextValueRef.current = nextVal;
    comboRef.current = 0;
    undoHistoryRef.current = [];
    pieceCountRef.current = 0;
    particlesRef.current = [];
  }, []);

  // Initialize
  useEffect(() => {
    restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-8 select-none"
      style={{ fontFamily: '"SF Pro Display", "Geist Sans", system-ui, sans-serif' }}
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111111]">
          数字消除方块
        </h1>
        <p className="text-[12px] text-[#787774] tracking-wide">
          相邻三个相同数字自动合并
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* Canvas */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            className="block"
            style={{
              borderRadius: "8px",
              border: isFrozen ? "2px solid #1F6C9F" : "1px solid #EAEAEA",
              background: isFrozen ? "#E8F4FD" : "#F7F6F3",
            }}
            tabIndex={0}
          />
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 min-w-[160px]">
          {/* Score */}
          <div
            className="p-5"
            style={{
              background: "#FFFFFF",
              border: "1px solid #EAEAEA",
              borderRadius: "8px",
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] mb-2 font-medium">
              得分
            </div>
            <div className="text-[28px] font-semibold tracking-[-0.03em] text-[#111111] tabular-nums">
              {score}
            </div>
            {/* Combo indicator */}
            {combo > 0 && !gameOver && (
              <div 
                className="mt-2 text-[11px] font-semibold px-2 py-1 inline-block"
                style={{
                  background: "#FDEBEC",
                  color: "#9F2F2D",
                  borderRadius: "4px",
                }}
              >
                🔥 连击 ×{combo}
              </div>
            )}
            {/* Undo indicator */}
            {undoCount > 0 && !gameOver && (
              <div 
                className="mt-1 text-[10px] px-2 py-1 inline-block"
                style={{
                  background: "#E1F3FE",
                  color: "#1F6C9F",
                  borderRadius: "4px",
                }}
              >
                ↩️ 可撤销 {undoCount}/3
              </div>
            )}
          </div>

          {/* Next preview */}
          <div
            className="p-5"
            style={{
              background: "#FFFFFF",
              border: "1px solid #EAEAEA",
              borderRadius: "8px",
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] mb-3 font-medium">
              下一个
            </div>
            <div className="flex justify-center">
              <div
                className="w-[44px] h-[44px] flex items-center justify-center font-semibold text-[15px]"
                style={{
                  background: getBlockStyle(nextValue).bg,
                  color: getBlockStyle(nextValue).text,
                  borderRadius: "6px",
                  border: "1px solid #EAEAEA",
                }}
              >
                {getBlockDisplay(nextValue)}
              </div>
            </div>
            {nextValue === 0 && (
              <div className="text-[10px] text-[#9F2F2D] mt-2 text-center">💣 炸弹</div>
            )}
            {nextValue === -1 && (
              <div className="text-[10px] text-[#1F6C9F] mt-2 text-center">❄️ 冰凍</div>
            )}
          </div>

          {/* Leaderboard */}
          <div
            className="p-5 cursor-pointer transition-all duration-200"
            style={{
              background: showLeaderboard ? "#F7F6F3" : "#FFFFFF",
              border: "1px solid #EAEAEA",
              borderRadius: "8px",
            }}
            onClick={() => setShowLeaderboard(!showLeaderboard)}
          >
            <div className="flex justify-between items-center mb-2">
              <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] font-medium">
                排行榜
              </div>
              <div className="text-[10px] text-[#787774]">
                {showLeaderboard ? "▲" : "▼"}
              </div>
            </div>
            {showLeaderboard ? (
              <div className="flex flex-col gap-1">
                {leaderboard.length === 0 ? (
                  <div className="text-[11px] text-[#AAA] py-2 text-center">
                    暂无记录
                  </div>
                ) : (
                  leaderboard.slice(0, 5).map((entry, i) => (
                    <div 
                      key={i} 
                      className="flex justify-between text-[11px] py-1"
                      style={{ color: i === 0 ? "#956400" : i === 1 ? "#787774" : i === 2 ? "#8B3A1A" : "#AAA" }}
                    >
                      <span className="font-medium">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                      </span>
                      <span className="tabular-nums">{entry.score}</span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-[11px] text-[#787774]">
                {leaderboard.length > 0 ? `最高: ${leaderboard[0].score}` : "点击展开"}
              </div>
            )}
          </div>

          {/* Controls */}
          <div
            className="px-5 py-4"
            style={{
              background: "#FFFFFF",
              border: "1px solid #EAEAEA",
              borderRadius: "8px",
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.08em] text-[#787774] mb-3 font-medium">
              操作
            </div>
            <div className="flex flex-col gap-2">
              {[
                ["← →", "左右移动"],
                ["↓", "加速下落"],
                ["↑", "直接落底"],
                ["Space", "暂停 / 继续"],
                ["Z", "撤销"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center min-w-[28px] h-[22px] px-1.5 text-[10px] font-medium"
                    style={{
                      background: "#F7F6F3",
                      border: "1px solid #EAEAEA",
                      borderRadius: "4px",
                      color: "#555",
                      fontFamily: '"SF Mono", "Geist Mono", monospace',
                    }}
                  >
                    {key}
                  </span>
                  <span className="text-[12px] text-[#787774]">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2">
            {/* Share button (only shown after game over) */}
            {showShareButton && (
              <button
                onClick={shareScore}
                className="w-full py-2.5 px-4 text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  background: "#1F6C9F",
                  color: "#FFFFFF",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#155A8A";
                  e.currentTarget.style.transform = "scale(0.98)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#1F6C9F";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                📤 分享成绩
              </button>
            )}

            {/* End game */}
            <button
              onClick={endGame}
              disabled={gameOver}
              className="w-full py-2.5 px-4 text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                background: gameOver ? "#EAEAEA" : "#111111",
                color: gameOver ? "#AAA" : "#FFFFFF",
                borderRadius: "6px",
                border: "none",
                cursor: gameOver ? "default" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!gameOver) {
                  e.currentTarget.style.background = "#333333";
                  e.currentTarget.style.transform = "scale(0.98)";
                }
              }}
              onMouseLeave={(e) => {
                if (!gameOver) {
                  e.currentTarget.style.background = "#111111";
                  e.currentTarget.style.transform = "scale(1)";
                }
              }}
            >
              结束游戏
            </button>

            {/* Restart */}
            <button
              onClick={restart}
              className="w-full py-2.5 px-4 text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                background: "#F7F6F3",
                color: "#111111",
                borderRadius: "6px",
                border: "1px solid #EAEAEA",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#EAEAEA";
                e.currentTarget.style.transform = "scale(0.98)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#F7F6F3";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              重新开始
            </button>

            {/* Pause/Resume */}
            <button
              onClick={() => setIsPaused(p => !p)}
              disabled={gameOver}
              className="w-full py-2.5 px-4 text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                background: gameOver ? "#F7F6F3" : "#FFFFFF",
                color: gameOver ? "#AAA" : "#111111",
                borderRadius: "6px",
                border: "1px solid #EAEAEA",
                cursor: gameOver ? "default" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!gameOver) {
                  e.currentTarget.style.background = "#F7F6F3";
                  e.currentTarget.style.transform = "scale(0.98)";
                }
              }}
              onMouseLeave={(e) => {
                if (!gameOver) {
                  e.currentTarget.style.background = "#FFFFFF";
                  e.currentTarget.style.transform = "scale(1)";
                }
              }}
            >
              {isPaused ? "继续" : "暂停"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
