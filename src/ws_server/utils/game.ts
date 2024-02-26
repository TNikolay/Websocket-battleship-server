import { lUsers } from '..'
import { IGame, IPosition, IShip } from '../types'
import { composeResponse } from './utils'

export const FIELD_SIZE = 10
enum CELL_STATE {
  EMPTY,
  SHOT,
  SHIP,
  DAMAGED,
  KILLED,
}

export enum ATTACK_RESULT {
  MISS = 'miss',
  KILLED = 'killed',
  SHOT = 'shot',
}

export function sendTurn(game: IGame, change) {
  if (change) game.turn = game.turn === game.user1 ? game.user2 : game.user1
  lUsers[game.user1].ws?.send(composeResponse('turn', { currentPlayer: game.turn }))
  lUsers[game.user2].ws?.send(composeResponse('turn', { currentPlayer: game.turn }))
}

function printField(f: number[][]) {
  for (let i = 0; i < f.length; i++) console.log(i, '-', f[i].join(''))
}

export function createGameField(ships: IShip[]) {
  const field = new Array(FIELD_SIZE)
  for (let i = 0; i < field.length; i++) field[i] = new Array(FIELD_SIZE).fill(CELL_STATE.EMPTY)

  for (const s of ships) {
    field[s.position.y][s.position.x] = CELL_STATE.SHIP
    for (let i = 1; i < s.length; i++) {
      if (s.direction) field[s.position.y + i][s.position.x] = CELL_STATE.SHIP
      else field[s.position.y][s.position.x + i] = CELL_STATE.SHIP
    }
  }

  printField(field)
  return field
}

export function attack(field: number[][], pos: IPosition): string {
  switch (field[pos.y][pos.x]) {
    case CELL_STATE.EMPTY:
      return ATTACK_RESULT.MISS
      break

    case CELL_STATE.SHIP:
      field[pos.y][pos.x] = CELL_STATE.SHOT
      return ATTACK_RESULT.SHOT
      break

    default:
      console.log('Oops, why we are here? ', pos)
      printField(field)
      return ATTACK_RESULT.MISS
  }
}

export function isShipKilled(field: number[][], ship: IShip) {
  console.log('isShipKilled ', ship)
  for (let i = 0; i < ship.length; i++) {
    let state = 0
    if (ship.direction) state = field[ship.position.y + i][ship.position.x]
    else state = field[ship.position.y][ship.position.x + i]
    console.log('isShipKilled ', state)
    if (state === CELL_STATE.SHIP) return false
  }

  return true
}
