/* eslint-disable no-console */

const Sangket = require('../models/sangketModel');

async function main() {
  await Sangket.ensureSchema();
  console.log('✅ sangket schema is ready');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ sangket migration failed:', error);
    process.exit(1);
  });
