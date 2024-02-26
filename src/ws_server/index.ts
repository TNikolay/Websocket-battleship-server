import { WebSocketServer } from 'ws'
import { IGame, IPosition, IRoom, IUser, WebSocketEx, lGamesType, lRoomsType, mapNameToIdType } from './types'
import { ATTACK_RESULT, FIELD_SIZE, attack, createGameField, isShipKilled, sendTurn } from './utils/game.ts'
import { composeResponse, getRandomNumber, getWinsTable, sendUpdateRoom } from './utils/utils.ts'

const PORT = 3000

const mapNameToId: mapNameToIdType = new Map()
export const lUsers: IUser[] = [{ name: 'dummy', password: 'dummy', wins: 0 }] // just want 1-based userID
export const lRooms: lRoomsType = new Map()
const lGames: lGamesType = new Map()

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
        sendUpdateRoom(wss)
      }
      if (user.game) {
        const game = lGames.get(user.game)
        if (!game) return console.log('Oops!!! Where is our game? ', data)

        const winner = game.user1 !== ws.userId ? game.user1 : game.user2

        lUsers[winner].wins++
        lUsers[winner].ws?.send(composeResponse('finish', { winPlayer: winner }))
        lUsers[winner].ws?.send(composeResponse('update_winners', getWinsTable()))
        lRooms.delete(user.game)
        user.game = undefined
      }
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

    case 'add_ships':
      handleAddShips(ws, data)
      break

    case 'attack':
      handleAttack(ws, data)
      break

    case 'randomAttack':
      {
        // TODO - make it smarter!
        data.x = getRandomNumber(FIELD_SIZE - 1)
        data.y = getRandomNumber(FIELD_SIZE - 1)
        handleAttack(ws, data)
      }
      break

    default:
      console.log('FTF???:', cmd)
  }
}

function handleAttack(ws: WebSocketEx, data: any) {
  const { x, y, gameId, indexPlayer } = data
  const position: IPosition = { x, y }
  const game = lGames.get(gameId)
  if (!game) return console.log('Oops!!! Where is our game? ', data)

  if (game.turn !== indexPlayer) return console.log('Wrong turn!')

  const victim = game.user1 !== indexPlayer ? game.user1 : game.user2
  let status = attack(game[victim].field, position)

  if (status === ATTACK_RESULT.SHOT) {
    for (let i = 0; i < game[victim].ship.length; i++) {
      const ship = game[victim].ship[i]
      if (isShipKilled(game[victim].field, ship)) {
        if (game[victim].ship.length === 1) {
          let res = composeResponse('finish', { winPlayer: indexPlayer })
          lUsers[game.user1].ws?.send(res)
          lUsers[game.user2].ws?.send(res)

          lUsers[indexPlayer].wins++
          const winners = getWinsTable()
          res = composeResponse('update_winners', winners)
          lUsers[game.user1].ws?.send(res)
          lUsers[game.user2].ws?.send(res)

          return
        }
        game[victim].ship.splice(i, 1)
        status = ATTACK_RESULT.KILLED
        break
      }
    }
  }

  const res = composeResponse('attack', { position, currentPlayer: indexPlayer, status })
  lUsers[game.user1].ws?.send(res)
  lUsers[game.user2].ws?.send(res)
  sendTurn(game, status === ATTACK_RESULT.MISS)
}

function handleAddShips(ws: WebSocketEx, data: any) {
  if (!ws.userId || !data?.gameId || !data?.ships) return console.log('Oops!!! Something wrong with data: ', data)

  const game = lGames.get(data.gameId)
  if (!game) return console.log('Oops! where is our game? ', data.gameId)

  game[ws.userId] = {}
  game[ws.userId].ship = data.ships
  game[ws.userId].field = createGameField(data.ships)

  if (game[game.user1] && game[game.user2]) {
    game.turn = Math.random() < 0.5 ? game.user1 : game.user2
    lUsers[game.user1].ws?.send(composeResponse('start_game', { ships: game[game.user1].ships, idPlayer: game.user1 }))
    lUsers[game.user2].ws?.send(composeResponse('start_game', { ships: game[game.user2].ships, idPlayer: game.user2 }))
    sendTurn(game, false)
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
  sendUpdateRoom(wss)
}

function handleAddUserToRoom(ws: WebSocketEx, index: number) {
  if (!ws.userId) return console.log('Oops!!!')
  const user = lUsers[ws.userId]
  if (!user) return console.log('Oops! where is our user? ', ws.userId)
  if (user.room === index) return // fix front bug

  const room = lRooms.get(index)
  if (!room) return console.log('Oops! where is our room? ', index)

  const firstUserIndex = room.roomUsers[0].index
  const firstUser = lUsers[firstUserIndex]
  if (!firstUser || !firstUser.ws) return console.log('Oops! where is our firstUser.ws? ', firstUserIndex, firstUser?.ws)

  const game: IGame = { gameId: nextGameId, user1: firstUserIndex, user2: ws.userId, turn: ws.userId }
  lGames.set(nextGameId++, game)

  firstUser.ws.send(composeResponse('create_game', { idGame: game.gameId, idPlayer: firstUserIndex }))
  firstUser.room = undefined

  firstUser.game = game.gameId
  user.game = game.gameId

  ws.send(composeResponse('create_game', { idGame: game.gameId, idPlayer: ws.userId }))

  lRooms.delete(room.roomId)
  if (user.room) lRooms.delete(user.room)
  sendUpdateRoom(wss)
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
    user = { name, password, wins: 0 }
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
  sendUpdateRoom(ws)
  ws.send(composeResponse('update_winners', getWinsTable()))
}
