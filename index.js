const HID = require('node-hid');
const _ = require('lodash');
const fs = require('fs');
const snake = require('./snake.js');
const devices = HID.devices();

const arduinoMap = key => key // identity, meaning don't remap
// const piMap = key => key % 2 === 0 ? key + 1 : key - 1; // odd<--->even :D
const piMap = arduinoMap;

const REMAP_TRIGGER_KEYS = Object.freeze([ 7, 8, 9 ]);
let remapIndex = 0;

const renderCallback = world => {
  if (!world.length) {
    return;
  }
  console.log("\n".repeat(100));
  
  for (let y = 0; y < world.length; ++y) {
    console.log(world[y]);
  }
}

snake.play(renderCallback);

const processRemap = key => {
  if (key === REMAP_TRIGGER_KEYS[remapIndex++]) {
    if (remapIndex === REMAP_TRIGGER_KEYS.length) {
      remapIndex = 0;
      piModel.map = arduinoModel.map;
    }
  } else {
    remapIndex = 0;
  }
};

const MACRO_TRIGGER_KEYS = Object.freeze([ 4, 5, 6 ]);
const MACRO_EMIT_KEYS = Object.freeze([
  4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
]);
let macroIndex = 0;
let macroEmitIndex = 0;
let macroIntervalId = null;
const MACRO_INTERVAL_MILLIS = 200;
const MACRO_KEY_MILLIS = MACRO_INTERVAL_MILLIS / 2;

const clearKeys = () => {
  writeReport([]);
};

const emitMacro = () => {
  if (macroEmitIndex < MACRO_EMIT_KEYS.length) {
    writeReport([0x00, 0x00, MACRO_EMIT_KEYS[macroEmitIndex++]]);
    setTimeout(clearKeys, MACRO_KEY_MILLIS);
  } else {
    macroEmitIndex = 0;
    clearInterval(macroIntervalId);
  }
};

const processMacro = key => {
  if (key === MACRO_TRIGGER_KEYS[macroIndex++]) {
    if (macroIndex === MACRO_TRIGGER_KEYS.length) {
      macroIndex = 0;
      macroIntervalId = setInterval(emitMacro, MACRO_INTERVAL_MILLIS);
    }
  } else {
    macroIndex = 0;
  }
};

const processSnake = key => {
  switch(key) {
    case 0x4f: return snake.goRight();
    case 0x50: return snake.goLeft();
    case 0x51: return snake.goDown();
    case 0x52: return snake.goUp();
    default: console.log('wtf? :', key); return;
  }
}

const arduino = Object.freeze({
  vendorId: 9025,
  productId: 32822,
});

const piKeeb = Object.freeze({
  vendorId: 1241,
  productId: 7,
  usagePage: 1,
  usage: 6
});

const arduinoRecognizerFunc = device => {
  return device.vendorId === arduino.vendorId && device.productId === arduino.productId;
};

const piRecognizerFunc = (device) => {
  return device.vendorId === piKeeb.vendorId &&
    device.productId === piKeeb.productId &&
    device.usagePage === piKeeb.usagePage &&
    device.usage === piKeeb.usage;
};

const getDevice = (name, recognizerFunc, required=false) => {
  const deviceInfo = devices.find(recognizerFunc);

  if (!deviceInfo && required) {
    console.error(`Device ${name} not found.`);
    process.exit(1);
  }

  if (!deviceInfo) {
    console.log(`Device ${name} not found.`);
  } else {
    console.log(`Device ${name} found :D`);
    const device = new HID.HID(deviceInfo.path);
    return device;
  }
};

const arduinoDevice = getDevice('Arduino', arduinoRecognizerFunc);
const piDevice = getDevice('Pi', piRecognizerFunc, true);

const arduinoModel = arduinoDevice && {
  normalKeysPressed: [],
  modifierKeysPressed: 0,
  map: arduinoMap,
};

const piModel = piDevice && {
  normalKeysPressed: [],
  modifierKeysPressed: 0,
  map: piMap,
};

let lastUpdate = [0];

const writeReport = report => {
  const localReport = report.slice(0);
  const numMissing = 8 - report.length;
  for (let i = 0; i < numMissing; ++i) {
    localReport.push(0x00);
  }
  const buffer = new Buffer(localReport);
  fs.writeFileSync('/dev/hidg0', new Buffer(localReport));
};

const makeProcessKeys = (model, otherModel) => {
  return (report) => {
    let keysChanged = false;

    // convert to array from buffer
    const _reportArray = [...report];

    // for some reason arduino reports come back with an extra leading byte
    const reportArray = Object.freeze(_reportArray.length === 9 ? _reportArray.slice(1) : _reportArray);

    // process modifiers
    const modifiersVal = reportArray[0];
    for (let powerOfTwo = 128; powerOfTwo >= 1; powerOfTwo /= 2) {
      if (modifiersVal & powerOfTwo) {
        if (!(model.modifierKeysPressed & powerOfTwo)) {
          model.modifierKeysPressed |= powerOfTwo;
          keysChanged = true;
	}
      } else {
        if (model.modifierKeysPressed & powerOfTwo) {
          model.modifierKeysPressed &= ~powerOfTwo;
          keysChanged = true;
	}
      }
    }

    // temporary list of pressed keys, since if we add to the model we can't compare the other way around
    const normalKeysNowPressed = [];
    const reportNormalKeys = Object.freeze(reportArray.slice(2));

    // process normal keys
    // check for fresh pressed keys
    for (let i = 0; i < reportNormalKeys.length; ++i) {
      const pressedKey = model.map(reportNormalKeys[i]);

      // check for the empty key (0), but we have to map first
      if (pressedKey != model.map(0)) {
        if (model.normalKeysPressed.indexOf(pressedKey) === -1) {
          normalKeysNowPressed.push(pressedKey);
	  processMacro(pressedKey);
	  processRemap(pressedKey);
          processSnake(pressedKey);
        }
      }
    }

    // check for no-longer-pressed keys
    const keysNoLongerPressed = [];
    for (let j = 0; j < model.normalKeysPressed.length; ++j) {
      const previouslyPressedKey = model.normalKeysPressed[j];
      if (reportNormalKeys.indexOf(previouslyPressedKey) === -1) {
        keysNoLongerPressed.push(previouslyPressedKey);
        model.normalKeysPressed = model.normalKeysPressed.filter(key => key !== previouslyPressedKey);
      }
    }

    // perform model update
    model.normalKeysPressed = model
      .normalKeysPressed
      .filter(previouslyPressedKey =>
        keysNoLongerPressed
          .indexOf(previouslyPressedKey) === -1);
    normalKeysNowPressed
      .forEach(pressedKey => {
        model.normalKeysPressed.push(pressedKey);
      });

    // perform state update based on both models
    let modifiers = model.modifierKeysPressed;
    if (otherModel) {
      modifiers |= otherModel.modifierKeysPressed;
    }
    const update = [modifiers, 0x00];
    model
      .normalKeysPressed
      .forEach(pressedKey => {
        update.push(pressedKey);
      });
    if (otherModel) {
      otherModel
        .normalKeysPressed
        .forEach(pressedKey => {
          if (update.indexOf(pressedKey) < 2) { // we don't want to check 0 which is a modifiers byte
            update.push(pressedKey);
	  }
        });
    }
    if (update.length > 8) {
      console.error(`update.length is ${update.length}, but a max of 8 is expected.`);
      while (update.length > 8) {
        update.pop();
      }
    }
    if (!_.isEqual(update, lastUpdate)) {
      lastUpdate = update;
      writeReport(update);
    }
  }
}

if (arduinoDevice) {
  arduinoDevice.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
  arduinoDevice.on('data', makeProcessKeys(arduinoModel, piModel));
}


piDevice.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

piDevice.on('data', makeProcessKeys(piModel, arduinoModel));

process.on('SIGINT', () => {
  console.log('caught SIGINT, shutting down ...');
  clearKeys();
  piDevice.close();
  console.log('pi device closed!');
  if (arduinoDevice) {
    arduinoDevice.close();
    console.log('arduino device closed!');
  }
  process.exit();
});
