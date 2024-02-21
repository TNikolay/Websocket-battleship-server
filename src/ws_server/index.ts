import { WebSocket, WebSocketServer } from 'ws'
import { IRoom, IUser, IUserNameAndId, WebSocketEx } from './types'

const PORT = 3000

const lUsers: IUser[] = []

type lRoomsType = Map<number, IRoom>
const lRooms: lRoomsType = new Map()

const lWinners = []
//const lConnection: WebSocket[] = []

let nextRoomId = 0 // don't forget to fix problem with overflow after reaching first millions of player!

// -----------------------------------------------------

const wss = new WebSocketServer({ port: PORT }, () => console.log(`Start WSServer on the ${PORT} port!`))

wss.on('connection', (ws: WebSocketEx) => {
  let user: IUserNameAndId

  //lConnection.push(ws)
  console.log(`new client connected, (${wss.clients.size} at server)`)

  ws.on('message', (mes: string) => handleMessage(ws, mes))

  ws.on('error', console.error)

  ws.on('close', () => {
    console.log('Client disconnected')
    // const index = lConnection.indexOf(ws)
    // if (index !== -1) lConnection.splice(index, 1)
    // else console.error('onClose error: strange ws?')

    // if (userId !== -1) lUsers[userId] = undefined
  })
})

const handleMessage = (ws: WebSocketEx, mes: string) => {
  const cmd = JSON.parse(mes)
  console.log('\n\nreceived: ', cmd)
  const data = cmd.data ? JSON.parse(cmd.data) : {}
  //console.log('data: ', data)

  switch (cmd.type) {
    case 'reg':
      handleLogin(ws, data.name, data.password)
      break

    case 'create_room':
      handleCreateRoom(ws)
      break

    case 'add_user_to_room':
      handleAddUserToRoom(ws, data.indexRoom)
      break

    default:
      console.log('FTF???:', cmd) // TODO
  }
}

function handleCreateRoom(ws: WebSocketEx) {
  const room: IRoom = {
    roomId: nextRoomId,
    roomUsers: [ws.user!],
  }
  lRooms.set(nextRoomId++, room)
  sendUpdateRoom(wss, lRooms)
}

function handleAddUserToRoom(ws: WebSocketEx, index: number) {
  console.log(index, lRooms)

  const room = lRooms.get(index)
  if (!room) return console.error('error: room is undefined!')
  if (room.roomUsers.length === 1 && room.roomUsers[0].name === ws.user?.name) return // fix front bug
  if (room.roomUsers.length > 1) return console.error('error: room is full!')
  room.roomUsers.push(ws.user!)
  sendUpdateRoom(wss, lRooms)

  // temp
  wss.clients.forEach((client: WebSocketEx) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(composeResponse('create_game', { idGame: 1, idPlayer: 1 }))
    } else console.log('Oops!: trying to send createGame to NOT OPEN socket ', client.readyState)
  })
}

function handleLogin(ws: WebSocketEx, name: string, password: string) {
  // console.log(name, lUsers)
  // if (lUsers.find(v => v.name === name)) {
  //   const data = {
  //     name: name,
  //     index: -1,
  //     error: true,
  //     errorText: 'User with such name already logged!',
  //   }
  //   ws.send(composeResponse('reg', data))
  //   return
  // }

  ws.user = { name, index: lUsers.length }
  const data = {
    name: name,
    index: ws.user.index,
    error: false,
    errorText: '',
  }

  lUsers.push({ name, password })

  ws.send(composeResponse('reg', data))
  sendUpdateRoom(ws, lRooms)
  // ws.send(composeResponse('update_winners', lWinners))
}

function composeResponse(type: string, data: Object) {
  const res = JSON.stringify({
    type,
    data: JSON.stringify(data),
    id: 0,
  })
  console.log('Send response: ', res)
  return res
}

function sendUpdateRoom(dest: WebSocketEx | WebSocketServer, data: lRoomsType) {
  const rooms: any[] = [] //data.filter(room => room[1].roomUsers.length === 1)
  for (let room of data.values()) {
    if (room.roomUsers.length === 1) rooms.push(room)
    // if (room.roomUsers.length === 1) {
    //   rooms.push({ roomId: room.roomId, roomUsers: JSON.stringify(room.roomUsers) })
    // }
  }

  if (dest instanceof WebSocketServer) {
    wss.clients.forEach((client: WebSocketEx) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(composeResponse('update_room', rooms))
      } else console.log('Oops!: trying to send updateRoom to NOT OPEN socket ', client.readyState)
    })
  } else {
    dest.send(composeResponse('update_room', rooms))
  }
}
