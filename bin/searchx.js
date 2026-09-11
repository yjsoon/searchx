#!/usr/bin/env node

const { main } = require('../src/cli');

main(process.argv.slice(2)).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
