var express = require('express'),
  app = express(),
  server = require('http').createServer(app),
  io = require('socket.io').listen(app.listen(app.get('port')));

app.set('port', process.env.PORT || 3000);
server.listen(3000);

app.use(express.static(__dirname + '/public'));
app.get('/', function(req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.get('/:id', function(req, res) {
  res.sendFile(__dirname + '/public/index.html');
});
//--------------------------------------------------
var rooms = [];

function Create2DArray(rows) {
  var arr = [];

  for (var i = 0; i < rows; i++)
    arr[i] = [];
  return arr;
}

function Room(roomName) {
  this.roomID = roomName;
  this.players = [];
  this.turn = 0;
  this.curPlayer = 1;
  this.grid = Create2DArray(6);
  this.scores = [];
  this.ready = false;
  this.victory = false;

  this.resetGrid = function() {
    for (r = 0; r < 6; r++)
      for (c = 0; c < 7; c++)
        this.grid[r][c] = -1;
  }

  this.resetGame = function(){
    this.turn = 0;
    this.curPlayer = 1;
    this.resetGrid();
    this.ready = true;
    this.victory = false;

    io.sockets.in(this.roomID).emit("resetGame");
  }

  this.chatMsg = function(msg) {
    io.sockets.in(this.roomID).emit("chatMsg", msg);
  }

  this.testVictory = function(r, c) {
    for (gR = 0; gR < 6; gR++) {
      for (gC = 0; gC < 7; gC++) {

        if (this.grid[gR][gC] == -1)
          continue;

        var h1 = 0,
          h2 = 0,
          v1 = 0,
          v2 = 0,
          d1 = 0,
          d2 = 0,
          d3 = 0,
          d4 = 0;

        for (rd = 0; rd < 5; rd++) {
          try {
            if (this.grid[gR][gC + rd] == this.curPlayer)
              h1++;
          } catch (e) {}

          try {
            if (this.grid[gR][gC - rd] == this.curPlayer)
              h2++;
          } catch (e) {}

          try {
            if (this.grid[gR - rd][gC] == this.curPlayer)
              v1++;
          } catch (e) {}

          try {
            if (this.grid[gR + rd][gC] == this.curPlayer)
              v2++;
          } catch (e) {}

          try {
            if (this.grid[gR - rd][gC - rd] == this.curPlayer)
              d1++;
          } catch (e) {}

          try {
            if (this.grid[gR - rd][gC + rd] == this.curPlayer)
              d2++;
          } catch (e) {}

          try {
            if (this.grid[gR + rd][gC + rd] == this.curPlayer)
              d3++;
          } catch (e) {}

          try {
            if (this.grid[gR - rd][gC + rd] == this.curPlayer)
              d4++;
          } catch (e) {}

          if (h1 >= 4 || h2 >= 4 || v1 >= 4 || v2 >= 4 || d1 >= 4 || d2 >= 4 || d3 >= 4 || d4 >= 4){
            this.scores[this.cur_player]++;
            return true;
          }
        }
      }
    }

    return false;
  }

  this.gridDrop = function(mouseX, cellSize) {
    var c = Math.trunc(mouseX / cellSize),
      r = 0;

    for (; r < 6; r++)
      if (this.grid[r][c] == -1)
        break;

    if (r < 6 && c < 7) {

      this.grid[r][c] = this.curPlayer;
      return {
        r: r,
        c: c
      };
    } else return null;
  }

  this.getTurn = function() {
    if (this.turn < 42) {
      io.sockets.in(this.roomID).emit("changeTurn", this.curPlayer);
      this.curPlayer = (this.curPlayer == 1 ? 2 : 1);
      this.turn++;
    }
  }
}

var createNewRoom = function(roomID){
  if (typeof rooms[roomID] == 'undefined') {
    rooms[roomID] = new Room(roomID);
    rooms[roomID].resetGrid();
    rooms[roomID].scores[0] = 0;
    rooms[roomID].scores[1] = 0;
  }
}
io.sockets.on('connection', function(socket) {
  console.log("new connection");

  socket.on('joinRoom', function(roomID, callback) {
    createNewRoom(roomID);

    var room = rooms[roomID];
    socket.join(roomID);
    socket.roomID = roomID;
    room.players.push(socket);

    if (room.players.length == 1)
      socket.ownerOfRoom = roomID;
    else
      socket.ownerOfRoom = -1;

    if (room.players.length >= 2) {
      room.chatMsg("Players Ready");
      room.ready = true;
      room.getTurn();
    }

    callback(room.players.length, rooms[socket.roomID].grid);
  });

  socket.on('mouseMoveTile', function(mouseX) {
    io.sockets.in(socket.roomID).emit("moveCurrentTile", mouseX);
  });

  socket.on('mouseDropTile', function(mouseX, cellSize) {
    console.log("Clicked");
    if(rooms[socket.roomID].ready != true)
      return;

    var dropCell = rooms[socket.roomID].gridDrop(mouseX, cellSize);
    if (dropCell != null) {
      if (rooms[socket.roomID].testVictory(dropCell.r, dropCell.c)){
        rooms[socket.roomID].ready = false;
        var victor = rooms[socket.roomID].curPlayer;
        var buffer = "Player " + victor + " wins! <br>";
            buffer += "[ Player 1: " + rooms[socket.roomID].scores[0] +
                      " | Player 2: " + rooms[socket.roomID].scores[1] + "]";
        rooms[socket.roomID].chatMsg(buffer);
        rooms[socket.roomID].victory = true;
//        rooms[socket.roomID].resetGame();
      }
      io.sockets.in(socket.roomID).emit("dropCurrentTile", dropCell);
    }
  });

  socket.on('finishedTurn', function() {
    console.log(rooms[socket.roomID].curPlayer);
    if(rooms[socket.roomID].victory){
      rooms[socket.roomID].resetGame();
    }
    else
      rooms[socket.roomID].getTurn();

  });

  socket.on('disconnect', function(){
    if(socket.ownerOfRoom != -1){
      delete rooms[socket.ownerOfRoom];
    }
  });

})
