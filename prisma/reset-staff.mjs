// Reset the seeded staff passwords on whichever database DATABASE_URL points at.
// Usage:  node --env-file=<file with DATABASE_URL> --env-file=<file with passwords> prisma/reset-staff.mjs
// Reads SUPERADMIN_PASSWORD (account "ceo") and ADMIN_PASSWORD (account "frontdesk"). Prints no secrets.
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();
const hash = (pw) => { const salt = randomBytes(16).toString("hex"); return `scrypt$${salt}$${scryptSync(pw, salt, 64).toString("hex")}`; };
const host = (process.env.DATABASE_URL ?? "").replace(/.*@/, "").split("/")[0] || "(no DATABASE_URL)";
const targets = [
  { username: "ceo", name: "Narh Richard Mashie", role: "superadmin", password: process.env.SUPERADMIN_PASSWORD },
  { username: "frontdesk", name: "Front desk", role: "admin", password: process.env.ADMIN_PASSWORD },
];
console.log(`Resetting staff passwords on ${host}`);
for (const t of targets) {
  if (!t.password || t.password.length < 8) { console.log(`  ${t.username}: skipped, password missing or under 8 characters`); continue; }
  await prisma.staff.upsert({
    where: { username: t.username },
    update: { passwordHash: hash(t.password), active: true },
    create: { username: t.username, name: t.name, role: t.role, passwordHash: hash(t.password) },
  });
  await prisma.activityLog.create({ data: { actorName: "system", action: "staff.password", targetType: "staff", summary: `Password reset for "${t.username}" by reset-staff script` } });
  console.log(`  ${t.username}: password set (${t.password.length} characters)`);
}
await prisma.$disconnect();
