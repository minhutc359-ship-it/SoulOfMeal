import assert from 'node:assert/strict';
import test from 'node:test';
import { adventurePuzzleHint, createAdventurePuzzle, playAdventurePuzzle, resolveAdventurePuzzle } from '../src/modes/adventurePuzzle.js';

test('hints are legal and playback preserves deterministic score and final board', () => {
  for (const id of ['chest', 'forge_valve']) for (const seed of [1, 42, 24601, 9137]) {
    const current = createAdventurePuzzle(id, seed);
    const snapshot = structuredClone(current);
    const [from, to] = adventurePuzzleHint(current);
    const { puzzle, steps } = resolveAdventurePuzzle(current, from, to);
    assert.notEqual(puzzle, current);
    assert.equal(puzzle.moves, current.moves + 1);
    assert.deepEqual(puzzle, playAdventurePuzzle(current, from, to));
    assert.deepEqual(current, snapshot);
    assert.equal(steps[0].kind, 'swap');
    assert.deepEqual(steps.at(-1).board, puzzle.board);
    assert.equal(steps.filter(step => step.kind === 'clear').reduce((n, step) => n + step.cells.length, 0), puzzle.score - current.score);
    for (const step of steps) {
      assert.equal(step.board.length, 36);
      assert.notEqual(step.board, puzzle.board);
      for (const move of step.movements ?? []) {
        assert.ok(move.to >= 0 && move.to < 36);
        if (step.kind === 'fall') assert.equal((move.from % 6 + 6) % 6, move.to % 6);
      }
    }
  }
});
test('invalid moves do not start playback or consume turns', () => {
  const current = createAdventurePuzzle('chest');
  const result = resolveAdventurePuzzle(current, 0, 35);
  assert.equal(result.puzzle, current);
  assert.deepEqual(result.steps, []);
});
test('slide hints identify adjacent nonempty tiles and trace the moved piece', () => {
  const current = createAdventurePuzzle('sanctum_seal');
  const blank = current.board.indexOf(0);
  assert.deepEqual(adventurePuzzleHint(current), [1, 3, 5, 7]);
  for (const at of adventurePuzzleHint(current)) {
    const result = resolveAdventurePuzzle(current, at, blank);
    assert.equal(result.puzzle.board[blank], current.board[at]);
    assert.equal(result.puzzle.board[at], 0);
    assert.deepEqual(result.steps[0].movements, [{ from: at, to: blank }]);
  }
});
