const SIZE = 6;
const INGREDIENT_TYPES = 5;

export const ADVENTURE_PUZZLES = {
  chest: {
    kind: 'match', title: 'Mở khóa rương tiếp tế',
    instructions: 'Chạm hai ô kề nhau để đổi chỗ. Ghép từ ba nguyên liệu giống nhau theo hàng hoặc cột.',
    goal: 21, moves: 6, reward: { gold: 30, essence: 5 },
  },
  forge_valve: {
    kind: 'match', title: 'Cân bằng lò hơi',
    instructions: 'Đổi chỗ hai nguyên liệu cạnh nhau để ghép từ ba viên cùng loại theo hàng hoặc cột.',
    goal: 33, moves: 10,
  },
  sanctum_seal: {
    kind: 'slide', title: 'Ghép lại bản khắc',
    instructions: 'Trượt ô cạnh khoảng trống để xếp các mảnh từ 1 đến 8 theo thứ tự trái sang phải, trên xuống dưới.',
  },
};

function adjacent(a, b, size) {
  return Math.abs(a % size - b % size) + Math.abs(Math.floor(a / size) - Math.floor(b / size)) === 1;
}

function swap(board, a, b) {
  [board[a], board[b]] = [board[b], board[a]];
}

function drawIngredient(puzzle) {
  puzzle.seed = (Math.imul(puzzle.seed, 1664525) + 1013904223) >>> 0;
  return (puzzle.seed >>> 16) % INGREDIENT_TYPES;
}

function matches(board) {
  const hits = new Set();
  for (const stride of [1, SIZE]) {
    for (let line = 0; line < SIZE; line++) {
      const first = line * (stride === 1 ? SIZE : 1);
      for (let i = 0; i < SIZE - 2; i++) {
        const a = first + i * stride, b = a + stride, c = b + stride;
        if (board[a] === board[b] && board[b] === board[c]) {
          hits.add(a); hits.add(b); hits.add(c);
        }
      }
    }
  }
  return hits;
}

export function puzzleMatchesAfterSwap(board, a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || !adjacent(a, b, SIZE)
      || a < 0 || b < 0 || a >= board.length || b >= board.length || board[a] === board[b]) return 0;
  const candidate = board.slice();
  swap(candidate, a, b);
  return matches(candidate).size;
}

function hasMove(board) {
  return board.some((_, at) => puzzleMatchesAfterSwap(board, at, at + 1) || puzzleMatchesAfterSwap(board, at, at + SIZE));
}

export function adventurePuzzleHint(puzzle) {
  if (puzzle.status !== 'playing') return [];
  if (ADVENTURE_PUZZLES[puzzle.id].kind === 'slide') {
    const blank = puzzle.board.indexOf(0);
    return puzzle.board.flatMap((value, at) => value && adjacent(at, blank, 3) ? [at] : []);
  }
  for (let from = 0; from < puzzle.board.length; from++) {
    for (const to of [from + 1, from + SIZE]) {
      if (puzzleMatchesAfterSwap(puzzle.board, from, to)) return [from, to];
    }
  }
  return [];
}

function newBoard(puzzle) {
  for (;;) {
    const board = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const col = i % SIZE;
      const exclude = new Set();
      if (col >= 2 && board[i - 1] === board[i - 2]) exclude.add(board[i - 1]);
      if (i >= SIZE * 2 && board[i - SIZE] === board[i - SIZE * 2]) exclude.add(board[i - SIZE]);
      const allowed = [0, 1, 2, 3, 4].filter(value => !exclude.has(value));
      board.push(allowed[drawIngredient(puzzle) % allowed.length]);
    }
    if (hasMove(board)) return board;
  }
}

export function createAdventurePuzzle(id, seed = 24601) {
  const spec = ADVENTURE_PUZZLES[id];
  if (!spec) return null;
  const puzzle = { id, seed, status: 'playing', score: 0, moves: 0 };
  // This authored arrangement is reachable by sliding from the solved board.
  puzzle.board = spec.kind === 'slide' ? [1, 5, 2, 7, 0, 3, 8, 4, 6] : newBoard(puzzle);
  return puzzle;
}

export function playAdventurePuzzle(current, from, to) {
  return resolveAdventurePuzzle(current, from, to).puzzle;
}

// Presentation trace is derived from deterministic rules, never from animation timing.
export function resolveAdventurePuzzle(current, from, to) {
  const steps = [];
  const unchanged = { puzzle: current, steps };
  if (current.status !== 'playing') return unchanged;
  const spec = ADVENTURE_PUZZLES[current.id];
  const board = current.board.slice();
  if (spec.kind === 'slide') {
    if (!Number.isInteger(from) || from < 0 || from >= board.length || board[to] !== 0 || !adjacent(from, to, 3)) return unchanged;
    swap(board, from, to);
    const won = board.every((value, index) => value === (index + 1) % 9);
    steps.push({ kind: 'swap', board: board.slice(), movements: [{ from, to }], size: 3 });
    return { puzzle: { ...current, board, moves: current.moves + 1, status: won ? 'won' : 'playing' }, steps };
  }
  if (!puzzleMatchesAfterSwap(board, from, to)) return unchanged;
  swap(board, from, to);
  steps.push({ kind: 'swap', board: board.slice(), movements: [{ from, to }, { from: to, to: from }], size: SIZE });
  const next = { ...current, board, moves: current.moves + 1 };
  let hits = matches(board);
  while (hits.size) {
    next.score += hits.size;
    steps.push({ kind: 'clear', board: board.slice(), cells: [...hits], score: next.score, size: SIZE });
    const movements = [];
    for (let col = 0; col < SIZE; col++) {
      let write = SIZE - 1;
      for (let row = SIZE - 1; row >= 0; row--) {
        const index = row * SIZE + col;
        if (!hits.has(index)) {
          const to = write-- * SIZE + col;
          board[to] = board[index];
          if (to !== index) movements.push({ from: index, to });
        }
      }
      let above = -1;
      while (write >= 0) {
        const to = write-- * SIZE + col;
        board[to] = drawIngredient(next);
        movements.push({ from: above-- * SIZE + col, to });
      }
    }
    steps.push({ kind: 'fall', board: board.slice(), movements, size: SIZE });
    hits = matches(board);
  }
  next.status = next.score >= spec.goal ? 'won' : next.moves >= spec.moves ? 'lost' : 'playing';
  if (next.status === 'playing' && !hasMove(board)) {
    next.board = newBoard(next);
    steps.push({ kind: 'shuffle', board: next.board.slice(), size: SIZE });
  }
  return { puzzle: next, steps };
}
