import { WebSocket } from 'ws'
export interface WebSocketEx extends WebSocket {
  user?: IUserNameAndId
}

export interface IUser {
  name: string
  password: string
}

export interface IUserNameAndId {
  name: string
  index: number
}

export interface IRoomUser {
  name: string
  index: number
}

export interface IRoom {
  roomId: number
  roomUsers: IRoomUser[]
}
