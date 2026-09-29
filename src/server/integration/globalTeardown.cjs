const { unlinkSync } = require('fs');
const path = require('path');

const URI_FILE = path.join(process.cwd(), '.jest-mongo-uri');

module.exports = async function () {
  if (global.__MONGOD__) await global.__MONGOD__.stop();
  try { unlinkSync(URI_FILE); } catch {}
};
