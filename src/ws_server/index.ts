import { WebSocket, WebSocketServer } from 'ws'
import { IDBUser, IRoom, IUser, IUserNameAndId, WebSocketEx, dbType } from './types'

const PORT = 3000

const db: dbType = new Map()

//const lUsers: IUser[] = []

type lRoomsType = Map<number, IRoom>
const lRooms: lRoomsType = new Map()

const lWinners = []
//const lConnection: WebSocket[] = []

let nextRoomId = 1 // don't forget to fix problem with overflow after reaching first millions of player!

// -----------------------------------------------------

const wss = new WebSocketServer({ port: PORT }, () => console.log(`Start WSServer on the ${PORT} port!`))

wss.on('connection', (ws: WebSocketEx) => {
  ws.userName = ''

  console.log(`new client connected, (${wss.clients.size} at server)`)

  ws.on('message', (mes: string) => handleMessage(ws, mes))

  ws.on('error', console.error)

  ws.on('close', () => {
    console.log(ws.userName ? `${ws.userName} disconnected` : 'client disconnected')

    if (ws.userName) {
      const user = db.get(ws.userName)
      if (user) {
        user.ws = undefined
        if (user.room) {
          lRooms.delete(user.room)
          user.room = undefined
          sendUpdateRoom(wss, lRooms)
        }
      }
    }
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
  const user = db.get(ws.userName)
  if (!user) return console.log('Oops! where is our user?')
  if (user.room) return // only 1 room for user, the server is not rubber!

  const room: IRoom = {
    roomId: nextRoomId,
    roomUsers: [{ name: ws.userName, index: user.id }],
  }
  lRooms.set(nextRoomId++, room)
  user.room = room.roomId
  sendUpdateRoom(wss, lRooms)
}

function handleAddUserToRoom(ws: WebSocketEx, index: number) {
  const user = db.get(ws.userName)
  if (!user) return console.log('Oops! where is our user? ', ws.userName)
  if (user.room) return // only 1 room for user, the server is not rubber!

  const room = lRooms.get(index)
  if (!room) return console.error('error: room is undefined!')
  if (room.roomUsers.length > 1) return console.error('error: room is full!')

  room.roomUsers.push({ name: ws.userName, index: user.id })
  lRooms.delete(room.roomId)
  sendUpdateRoom(wss, lRooms)

  const idPlayer = user.id
  room.roomUsers.forEach(user => {
    const realUser = db.get(user.name)
    if (!realUser) return console.log('Oops! where is our user? ', user.name)
    realUser.room = undefined

    const ws = realUser.ws
    if (!ws) return console.log('Oops! where is our user.ws?')
    if (ws.readyState === WebSocket.OPEN) ws.send(composeResponse('create_game', { idGame: 1, idPlayer }))
    else console.log('Oops!: trying to send createGame to NOT OPEN socket ', ws.readyState)
  })
}

function handleLogin(ws: WebSocketEx, name: string, password: string) {
  let user = db.get(name)
  if (user) {
    if (user.password !== password) {
      const res = {
        name: name,
        index: user.id,
        error: true,
        errorText: `Invalid password for user ${name}`,
      }
      ws.send(composeResponse('reg', res))
      return
    } else if (user.ws) {
      // TODO - check if connection is alive or maybe kill it?
      const res = {
        name: name,
        index: user.id,
        error: true,
        errorText: `User with name ${name} already logged!`,
      }
      ws.send(composeResponse('reg', res))
      return
    }
  } else {
    // create a new user in db
    user = { id: db.size + 1, password }
    db.set(name, user)
  }

  user.ws = ws
  ws.userName = name

  const res = {
    name: name,
    index: user.id,
    error: false,
    errorText: '',
  }

  ws.send(composeResponse('reg', res))
  sendUpdateRoom(ws, lRooms)
  ws.send(composeResponse('update_winners', lWinners))
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
  const rooms: IRoom[] = []
  for (let room of data.values()) {
    if (room.roomUsers.length === 1) rooms.push(room)
  }

  const res = composeResponse('update_room', rooms)
  if (dest instanceof WebSocketServer) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(res)
      else console.log('Oops!: trying to send updateRoom to NOT OPEN socket ', client.readyState)
    })
  } else dest.send(res)
}
