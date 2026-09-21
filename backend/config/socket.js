let ioInstance = null;

function setIO(io) {
  ioInstance = io;
  global._io = io;
  return ioInstance;
}

function getIO() {
  return ioInstance || global._io;
}

module.exports = {
  setIO,
  initIO: setIO,
  getIO,
};
