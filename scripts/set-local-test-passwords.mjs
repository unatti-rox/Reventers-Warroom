// LOCAL DEV ONLY — sets known passwords on a couple of accounts so this
// session can test role-based views end to end. Never run against a real
// deployment's DATABASE_URL.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { scryptSync, randomBytes } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url || !new URL(url).hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
  console.error("Refusing to run: DATABASE_URL is not localhost.");
  process.exit(1);
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const SETS = [
  { name: "Ishika", password: "testpass123" },
  { name: "Prutha", password: "testpass123" },
];

for (const s of SETS) {
  const person = await prisma.person.findUnique({ where: { name: s.name } });
  if (!person) {
    console.log(`skip: ${s.name} not found`);
    continue;
  }
  await prisma.person.update({
    where: { id: person.id },
    data: { passwordHash: hashPassword(s.password), mustChangePassword: false, active: true },
  });
  console.log(`set password for ${s.name} (${person.appRole})`);
}

await prisma.$disconnect();
