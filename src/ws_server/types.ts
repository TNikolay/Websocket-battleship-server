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
}

export type mapNameToIdType = Map<string, number>
export type lRoomsType = Map<number, IRoom>
export type lGamesType = Map<number, IGame>
