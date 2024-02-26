import { WebSocket } from 'ws'
export interface WebSocketEx extends WebSocket {
  userId?: number
}

export interface IUser {
  name: string
  password: string
  ws?: WebSocketEx
  room?: number
  game?: number
  wins: number
}

export interface IRoomUser {
  name: string
  index: number
}

export interface IRoom {
  roomId: number
  roomUsers: IRoomUser[]
}

export interface IGame {
  gameId: number
  user1: number
  user2: number
  turn: number
}

export interface IPosition {
  x: number
  y: number
}

export interface IShip {
  position: IPosition
  direction: boolean
  length: number
  type: 'small' | 'medium' | 'large' | 'huge'
}

export interface IWinTableEntry {
  name: string
  wins: number
}

export type mapNameToIdType = Map<string, number>
export type lRoomsType = Map<number, IRoom>
export type lGamesType = Map<number, IGame>
