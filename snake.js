const TICK_MILLIS = 200;
const ARENA_X_SIZE = 20;
const ARENA_Y_SIZE = 8;
const X_INDEX = 1;
const Y_INDEX = 0;
const INITIAL_SIZE = 1;
const NOTHING = 0;
const SNAKE = 1;
const TREAT = 2;

const randomPoint = () =>
  [ARENA_Y_SIZE, ARENA_X_SIZE]
    .map(size => Math.floor(Math.random() * size));

const randomVelocity = () => {
  const dimension = Math.floor(Math.random() * 2);
  return [0, 0]
    .map((_, i) =>
      i === dimension ? 1 : 0);
};

let game = {};

const randomTreat = (forbiddenPositionsList) => {
  let treat = randomPoint();
  while(forbiddenPositionsList
    .some(forbiddenPosition =>
      forbiddenPosition
        .every((coord, i) =>
          coord === treat[i]))) {
    treat = randomPoint();
  }
  return treat;
};

const render = () => {
  const world = [];
  for (let y = 0; y < ARENA_Y_SIZE; ++y) {
    const column = [];
    world.push(column);
    for (let x = 0; x < ARENA_X_SIZE; ++x) {
      column.push(NOTHING);
    }
  }
  
  // render the snake
  world[game.snake.position[0]][game.snake.position[1]] = SNAKE;
  game.snake.history
    .forEach(snakeSegmentLocation => {
      world[snakeSegmentLocation[0]][snakeSegmentLocation[1]] = SNAKE;
    });

  // render the treats
  game.treats
    .forEach(treat => {
      world[treat[0]][treat[1]] = TREAT;
    });

  const topAndBottomRow = ['+', '-'.repeat(world[0].length), '+'].join('');
  const scoreFormatted = `${game.snake.size - 1}`;
  const board = [
    topAndBottomRow,
    ['|', ' Score: ', scoreFormatted, ' '.repeat(world[0].length - 8 - scoreFormatted.length), '|'].join(''),
    topAndBottomRow,
    ...(
      world.map(row =>
        [
          '|',
          ...(
            row
              .map(c => {
                switch(c) {
                  case SNAKE: return 'S';
                  case TREAT: return '*';
                  case NOTHING: return ' ';
                  default: return ' ';
                }
              })
          ),
          '|',
        ].join('')
      )
    ),
    topAndBottomRow,
  ];
  return board;
};

const updateGame = () => {
  const nextSnakePosition = game.snake.position
    .map((coord, coordIndex) =>
      coord + game.snake.velocity[coordIndex]);

  const dead = game.snake.history
    .some(segmentLocation =>
      segmentLocation
        .every((val, i) =>
          val === nextSnakePosition[i]));

  if (dead) {
    quitGame();
  }

  const nextTreatEaten = game.treats
    .filter(treatLoc =>
      !treatLoc
        .some((val, i) =>
          val !== nextSnakePosition[i]));

  const nextSnakeSize = game.snake.size + nextTreatEaten.length;

  const nextSnake = {
    ...game.snake,
    position: nextSnakePosition,
    size: nextSnakeSize,
    history: [game.snake.position, ...game.snake.history].slice(0, nextSnakeSize - 1),
  };


  // wrap the snake around to the other side of the world like pacman
  if (nextSnake.position[0] > ARENA_Y_SIZE - 1 ||
    nextSnake.position[0] < 0) {
    nextSnake.position[0] = (nextSnake.position[0] + ARENA_Y_SIZE) % ARENA_Y_SIZE;
  }
  if (nextSnake.position[1] > ARENA_X_SIZE - 1 ||
    nextSnake.position[1] < 0) {
    nextSnake.position[1] = (nextSnake.position[1] + ARENA_X_SIZE) % ARENA_X_SIZE;
  }

  const nextTreats = game.treats
    .filter(treatLoc =>
      treatLoc
        .some((val, i) =>
          val !== nextSnake.position[i]));
  if (nextTreats.length === 0) {
    nextTreats.push(randomTreat([nextSnake.position]));
  }

  const nextGame = { // todo fixme it is a state object, not a different game
    ...game,
    snake: nextSnake,
    treats: nextTreats,
  };
  game = nextGame;
  const world = render();
  game.renderCallback(world);
};

const goLeft = () => {
  if (!!game.snake.velocity[0]) {
    game.snake.velocity = [0, -1];
  }
};

const goRight = () => {
  if (!!game.snake.velocity[0]) {
    game.snake.velocity = [0, 1];
  }
};

const goUp = () => {
  if (!!game.snake.velocity[1]) {
    game.snake.velocity = [-1, 0];
  }
};

const goDown = () => {
  if (!!game.snake.velocity[1]) {
    game.snake.velocity = [1, 0];
  }
};

const initGame = () => {
  const nextSnakePosition = randomPoint();
  const nextGame = {
    snake: {
      size: INITIAL_SIZE,
      position: nextSnakePosition,
      velocity: randomVelocity(),
      history: [],
    },
    treats: [randomTreat([nextSnakePosition])],
    intervalId: setInterval(updateGame, TICK_MILLIS),
  };
  game = nextGame;
};

const quitGame = () => {
  clearInterval(game.intervalId);
  setTimeout(() => {
    console.log('🐍: Thankssss for partissssipating! Ssssee you nexssst time 👋');
  }, 1000);
};

const play = (renderCallback) => {
  initGame();
  game.renderCallback = renderCallback;
};

module.exports = {
  play,
  goLeft,
  goRight,
  goUp,
  goDown,
  NOTHING,
  SNAKE,
  TREAT,
};
