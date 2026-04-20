const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { writeFileSync } = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const URI_FILE = path.join(process.cwd(), '.jest-mongo-uri');

module.exports = async function () {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri('scrollrack_test');

  global.__MONGOD__ = replSet;
  writeFileSync(URI_FILE, uri, 'utf8');

  execSync('npx prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: uri },
    stdio: 'inherit',
  });
};
