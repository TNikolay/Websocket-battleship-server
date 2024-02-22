import { WebSocketServer } from 'ws'
import { IGame, IRoom, IUser, WebSocketEx, lGamesType, lRoomsType, mapNameToIdType } from './types'
import { composeResponse, sendUpdateRoom } from './utils/utils.ts'

const PORT = 3000

const mapNameToId: mapNameToIdType = new Map()
const lUsers: IUser[] = [{ name: 'dummy', password: 'dummy' }] // just want 1-based userID
const lRooms: lRoomsType = new Map()
const lGames: lGamesType = new Map()
const lWinners = []

// don't forget to fix problem with overflow after reaching first millions of player!
let nextRoomId = 1
let nextGameId = 1

// -----------------------------------------------------

const wss = new WebSocketServer({ port: PORT }, () => console.log(`Start WSServer on the ${PORT} port!`))

wss.on('connection', (ws: WebSocketEx) => {
  console.log(`new client connected, (${wss.clients.size} at server)`)

  ws.on('message', (mes: string) => handleMessage(ws, mes))

  ws.on('error', console.error)

  ws.on('close', () => {
    console.log(ws.userId ? `${lUsers[ws.userId].name} disconnected` : 'client disconnected')
    if (ws.userId && lUsers[ws.userId]) {
      const user = lUsers[ws.userId]
      user.ws = undefined
      if (user.room) {
        lRooms.delete(user.room)
        user.room = undefined
        sendUpdateRoom(wss, lRooms)
      }
      // TODO user.game
    }
  })
})

const handleMessage = (ws: WebSocketEx, mes: string) => {
  const cmd = JSON.parse(mes)
  console.log('\n\nreceived: ', cmd)
  const data = cmd.data ? JSON.parse(cmd.data) : {}

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
  if (!ws.userId) return console.log('Oops!!!')
  const user = lUsers[ws.userId]
  if (!user) return console.log('Oops! where is our user? ', ws.userId)
  if (user.room) return // only 1 room for user, the server is not rubber!

  const room: IRoom = {
    roomId: nextRoomId,
    roomUsers: [{ name: user.name, index: ws.userId }],
  }
  lRooms.set(nextRoomId++, room)
  user.room = room.roomId
  sendUpdateRoom(wss, lRooms)
}

function handleAddUserToRoom(ws: WebSocketEx, index: number) {
  if (!ws.userId) return console.log('Oops!!!')
  const user = lUsers[ws.userId]
  if (!user) return console.log('Oops! where is our user? ', ws.userId)
  if (user.room === index) return // fix front bug

  const room = lRooms.get(index)
  if (!room) return console.log('Oops! where is our room? ', index)

  const firstUser = lUsers[room.roomUsers[0].index]
  if (!firstUser || !firstUser.ws) return console.log('Oops! where is our firstUser.ws? ', room.roomUsers[0].index, firstUser?.ws)

  const game: IGame = { gameId: nextGameId, user1: room.roomUsers[0].index, user2: ws.userId }
  lGames.set(nextGameId++, game)
  const res = composeResponse('create_game', { idGame: 1, idPlayer: ws.userId })

  firstUser.ws.send(res)
  firstUser.room = undefined

  firstUser.game = game.gameId
  user.game = game.gameId

  ws.send(res)

  lRooms.delete(room.roomId)
  if (user.room) lRooms.delete(user.room)
  sendUpdateRoom(wss, lRooms)
}

function handleLogin(ws: WebSocketEx, name: string, password: string) {
  let userId = mapNameToId.get(name)
  let user = userId ? lUsers[userId] : undefined

  if (user) {
    if (user.password !== password) {
      const res = {
        name: name,
        index: userId,
        error: true,
        errorText: `Invalid password for user ${name}`,
      }
      ws.send(composeResponse('reg', res))
      return
    } else if (user.ws) {
      // TODO - check if connection is alive or maybe kill it?
      const res = {
        name: name,
        index: userId,
        error: true,
        errorText: `User with name ${name} already logged!`,
      }
      ws.send(composeResponse('reg', res))
      return
    }

    if (user.game || user.room) console.error('!!!!! We should not see this !!!! user.game, user.room: ', user.game, user.room)
  } else {
    // create a new user in db
    userId = lUsers.length
    user = { name, password }
    lUsers[userId] = user
    mapNameToId.set(name, userId)
  }

  user.ws = ws
  user.room = user.game = undefined // just for case...:)
  ws.userId = userId

  const res = {
    name: name,
    index: userId,
    error: false,
    errorText: '',
  }

  ws.send(composeResponse('reg', res))
  sendUpdateRoom(ws, lRooms)
  ws.send(composeResponse('update_winners', lWinners))
}
