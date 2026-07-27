const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function test() {
  const prisma = new PrismaClient();
  const files = await prisma.file.findMany({ where: { type: 'file' }, take: 1 });
  if (files.length > 0) {
    const file = files[0];
    const storageDir = path.resolve('/app/storage/uploads'); // Inside docker, but on host?
    console.log('Found file:', file.name, file.physicalPath);
  } else {
    console.log('No files found');
  }
}
test().catch(console.error);
