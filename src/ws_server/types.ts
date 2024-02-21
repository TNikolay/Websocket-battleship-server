import { WebSocket } from 'ws'
export interface WebSocketEx extends WebSocket {
  userName: string
}

export interface IDBUser {
  id: number
  password: string
  ws?: WebSocketEx
  room?: number
}

export type dbType = Map<string, IDBUser>

export interface IUser {
  name: string
  password: string
}

export interface IRoomUser {
  name: string
  index: number
}

export interface IRoom {
  roomId: number
  roomUsers: IRoomUser[]
}
