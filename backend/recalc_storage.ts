import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  for (const user of users) {
    const files = await prisma.file.findMany({
      where: { ownerId: user.id }
    });
    let totalSize = BigInt(0);
    for (const file of files) {
      if (file.type !== 'folder') {
        totalSize += file.size;
      }
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { storageUsed: totalSize }
    });
    console.log(`Updated user ${user.email} storage to ${totalSize}`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
