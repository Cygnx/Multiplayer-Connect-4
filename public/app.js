var canvas = document.getElementById("canvas"),
  two = new Two({
    fullscreen: false
  }).appendTo(canvas),
  tiles = [],
  socket,
  // constants
  rows = 8,
  cellSize = (two.width / rows),
  tileSize = 30,
  dropSpeed = 10,
  //counters
  my_player_id = -1,
  cur_player = 1,
  cur_tile = 0;
  moving = false;

function makeGrid() {
  for (i = 0; i < rows; i++) {
    var ind = i * (two.width / rows),
      line = two.makeLine(ind, 0, ind, two.height),
      line2 = two.makeLine(0, ind, two.width - 80, ind);

    line.linewidth = 5;
    line2.linewidth = 5;
    line.stroke = "#FFECB3";
    line2.stroke = "#FFECB3";
  }
}

function makeTiles() {
  for (i = 0; i < 42; i++) {
    var tile = two.makeCircle(0, -1, tileSize);
    tile.visible = false;
    tiles.push(tile);

  }
};

function dropTile(dropCell, callback) {
  moving = true;

  var r = dropCell.r,
    c = dropCell.c;

  two.bind("update", function(frameCount) {
    tiles[cur_tile].translation.x = c * cellSize + cellSize / 2;
    if (tiles[cur_tile].translation.y < (6 - r) * cellSize - cellSize / 2 - 1)
      tiles[cur_tile].translation.y += dropSpeed;
    else {
      two.unbind("update");
      cur_tile++;
      callback();
    }
  });
}

function connect() {
  jQuery(function($) {
    socket = io.connect();
    var $chatBox = $('#chat');
    var gameID = window.location.href.split('/');
    gameID = gameID[gameID.length-1];
    socket.emit('joinRoom', gameID, function(playerID, grid) {
      my_player_id = playerID;

      for (gR = 0; gR < 6; gR++) {
        for (gC = 0; gC < 7; gC++) {

          if (grid[gR][gC] == -1)
            continue;

            tiles[cur_tile].visible = true;
            tiles[cur_tile].fill = (grid[gR][gC] == 2 ? '#FF8000' : '#0000ff');
            tiles[cur_tile].translation.x = gC * cellSize + cellSize / 2;
            tiles[cur_tile].translation.y = (6 - gR) * cellSize - cellSize / 2;
            cur_tile++;
        }
      }
    });

    socket.on('chatMsg', function(msg) {
      $chatBox.append(msg + "<br/>");
    });

    socket.on('changeTurn', function(player) {
      cur_player = player;
    });

    socket.on('moveCurrentTile', function(mouseX) {
      var tile = tiles[cur_tile];

      if (tile.visible == false)
        tile.visible = true;

      tile.fill = (cur_player == 1 ? '#FF8000' : '#0000ff');
      tile.translation.x = mouseX;
    });

    socket.on('dropCurrentTile', function(dropCell) {
      dropTile(dropCell, function() {
        moving = false;
        console.log(cur_player);
        if (cur_player == my_player_id)
          socket.emit('finishedTurn');
      });
    });

    socket.on('resetGame', function() {
      my_player_id = (my_player_id == 1 ? 2 : 1);
      //cur_player = -1;
      cur_tile = 0;

      for(i = 0; i < tiles.length; i++){
        tiles[i].visible = false;
        tiles[i].translation.y = -1;
      }
      socket.emit('finishedTurn');
    });
  })
}

$(window)
  .bind('click', function(e) {
    if (cur_player == my_player_id && !moving) {
      socket.emit('mouseDropTile', e.clientX - $('#canvas').offset().left, cellSize);
    }
  })
  .bind('mousemove', function(e) {
    if (cur_player == my_player_id) {
      socket.emit('mouseMoveTile', e.clientX - $('#canvas').offset().left);
    }
  })

makeGrid();
makeTiles();
two.play();
connect();
