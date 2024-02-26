import WebSocket, { WebSocketServer } from 'ws'
import { lRooms, lUsers } from '..'
import { IWinTableEntry, WebSocketEx } from '../types'

export function composeResponse(type: string, data: Object) {
  const res = JSON.stringify({
    type,
    data: JSON.stringify(data),
    id: 0,
  })
  console.log('Send response: ', res)
  return res
}

export function sendUpdateRoom(dest: WebSocketEx | WebSocketServer) {
  const res = composeResponse('update_room', [...lRooms.values()])
  if (dest instanceof WebSocketServer) {
    dest.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(res)
      else console.log('Oops!: trying to send updateRoom to NOT OPEN socket ', client.readyState)
    })
  } else dest.send(res)
}

export function getRandomNumber(max: number) {
  return Math.floor(Math.random() * (max + 1))
}

export function getWinsTable() {
  const res: IWinTableEntry[] = []
  for (const user of lUsers) {
    if (user.wins > 0) res.push({ name: user.name, wins: user.wins })
  }

  return res
}
