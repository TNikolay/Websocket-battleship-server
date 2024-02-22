import WebSocket, { WebSocketServer } from 'ws'
import { WebSocketEx, lRoomsType } from '../types'

export function composeResponse(type: string, data: Object) {
  const res = JSON.stringify({
    type,
    data: JSON.stringify(data),
    id: 0,
  })
  console.log('Send response: ', res)
  return res
}

export function sendUpdateRoom(dest: WebSocketEx | WebSocketServer, rooms: lRoomsType) {
  const res = composeResponse('update_room', [...rooms.values()])
  if (dest instanceof WebSocketServer) {
    dest.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(res)
      else console.log('Oops!: trying to send updateRoom to NOT OPEN socket ', client.readyState)
    })
  } else dest.send(res)
}
