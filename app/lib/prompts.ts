import type { Difficulty } from './types'

const prompts: Record<Difficulty, string[]> = {
  concrete: [
    'Draw a house', 'Draw a cat', 'Draw a tree', 'Draw a car',
    'Draw a flower', 'Draw a fish', 'Draw a sun', 'Draw a dog',
    'Draw a boat', 'Draw a pizza',
  ],
  abstract: [
    'Draw happiness', 'Draw loneliness', 'Draw music', 'Draw time',
    'Draw silence', 'Draw chaos', 'Draw freedom', 'Draw love',
    'Draw anger', 'Draw peace',
  ],
  complex: [
    'Draw a bicycle', 'Draw a helicopter', 'Draw a castle', 'Draw a robot',
    'Draw an elephant', 'Draw a guitar', 'Draw a spaceship',
    'Draw a rollercoaster', 'Draw a dinosaur', 'Draw a lighthouse',
  ],
  action: [
    'Someone running late', 'A chef cooking disaster', 'Someone slipping on ice',
    'A surprise birthday party', 'Someone lost in a forest', 'A cat chasing a laser',
    'Someone trying to park', 'A dog stealing food', 'Someone skydiving',
    'A kid seeing snow for the first time',
  ],
  chaotic: [
    'Something both hot and cold', 'A loud silence', 'Organized chaos',
    'A happy disaster', 'Something big and tiny', 'A fast snail',
    'Dry rain', 'A friendly monster', 'Beautiful ugliness', 'Calm panic',
  ],
}

const roundDifficulty: Record<number, Difficulty> = {
  1: 'concrete',
  2: 'abstract',
  3: 'complex',
  4: 'action',
  5: 'chaotic',
}

export function getPromptForRound(round: number): string {
  const difficulty = roundDifficulty[round] || 'concrete'
  const pool = prompts[difficulty]
  return pool[Math.floor(Math.random() * pool.length)]
}

export function getDifficulty(round: number): Difficulty {
  return roundDifficulty[round] || 'concrete'
}
