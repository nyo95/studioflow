import { canEditPhase } from "../src/lib/permissions";
import { Role, PhaseName } from "../generated/prisma";

const testCases: { role: Role; phase: PhaseName; expected: boolean }[] = [
  { role: "ADMIN", phase: "MOODBOARD", expected: true },
  { role: "ADMIN", phase: "CD", expected: true },
  { role: "STAFF", phase: "MOODBOARD", expected: false },
  { role: "DIC", phase: "MOODBOARD", expected: true },
  { role: "DIC", phase: "CD", expected: false },
  { role: "DRIC", phase: "MOODBOARD", expected: false },
  { role: "DRIC", phase: "CD", expected: true },
];

let failed = false;
testCases.forEach(({ role, phase, expected }) => {
  const result = canEditPhase(role, phase);
  if (result !== expected) {
    console.error(`FAIL: Role ${role} on Phase ${phase} expected ${expected} but got ${result}`);
    failed = true;
  } else {
    console.log(`PASS: Role ${role} on Phase ${phase} -> ${result}`);
  }
});

if (failed) {
  process.exit(1);
} else {
  console.log("All permission tests passed!");
}
