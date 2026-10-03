require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const existingTeacher = await prisma.user.findFirst({ where: { role: "TEACHER" } });

  if (!existingTeacher) {
    // No built-in default password: a well-known default is exactly what
    // attackers try first. The teacher's password must come from .env.
    const seedPassword = process.env.SEED_TEACHER_PASSWORD;
    if (!seedPassword || seedPassword.length < 10) {
      throw new Error("Set SEED_TEACHER_PASSWORD in .env to a strong password (at least 10 characters) before running the seed.");
    }
    const passwordHash = await bcrypt.hash(seedPassword, 12);
    await prisma.user.create({
      data: {
        email: (process.env.SEED_TEACHER_EMAIL || "teacher@teacherhub.local").toLowerCase(),
        passwordHash,
        role: "TEACHER",
        teacherProfile: {
          create: { fullName: process.env.SEED_TEACHER_NAME || "Teacher" },
        },
      },
    });
    console.log("Created initial teacher account:", process.env.SEED_TEACHER_EMAIL);
  } else {
    console.log("A teacher account already exists — skipping teacher seed.");
  }

  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
