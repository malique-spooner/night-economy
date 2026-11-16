import { spawnSync } from "node:child_process";

const checks = [
  {
    name: "Runtime",
    command: ["npm", "run", "runtime:verify"],
    required: true,
  },
  {
    name: "Cloudflare Worker config",
    command: ["npm", "run", "cloudflare:config"],
    required: true,
  },
  {
    name: "Supabase SQL/RLS guardrails",
    command: ["npm", "run", "supabase:verify-sql"],
    required: true,
  },
  {
    name: "Supabase Edge Function guardrails",
    command: ["npm", "run", "supabase:functions"],
    required: true,
  },
  {
    name: "Live smoke script guardrails",
    command: ["npm", "run", "supabase:verify-smoke"],
    required: true,
  },
  {
    name: "Pricing engine sync",
    command: ["npm", "run", "pricing:sync"],
    required: true,
  },
  {
    name: "Supabase local env",
    command: ["npm", "run", "supabase:status"],
    required: true,
  },
  {
    name: "Live Supabase public read smoke",
    command: ["npm", "run", "supabase:smoke-live"],
    required: false,
  },
];

const results = [];
for (const check of checks) {
  const envFailed = results.some(result => result.name === "Supabase local env" && result.status === "fail");
  if (check.name === "Live Supabase public read smoke" && envFailed) {
    results.push({
      ...check,
      status: "skip",
      summary: "Skipped until Supabase local env passes.",
    });
    continue;
  }

  results.push(runCheck(check));
}
const failedRequired = results.filter(result => result.required && result.status === "fail");
const blockedOptional = results.filter(result => !result.required && ["fail", "skip"].includes(result.status));

console.log("Launch readiness:");
for (const result of results) {
  const marker = result.status === "pass" ? "ok" : result.required ? "fail" : "todo";
  console.log(`- ${marker}: ${result.name}`);
  if (result.summary) console.log(`  ${result.summary}`);
}

if (blockedOptional.length) {
  console.log("");
  console.log("Optional live checks are expected to wait until real Supabase values and migrated data exist.");
}

if (failedRequired.length) {
  console.log("");
  console.log("Launch readiness failed. Fix required checks above before deployment.");
  process.exit(1);
}

console.log("");
console.log("Required launch readiness checks passed.");

function runCheck(check) {
  const [command, ...args] = check.command;
  const result = spawnSync(command, args, { encoding: "utf8" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();

  return {
    ...check,
    status: result.status === 0 ? "pass" : "fail",
    summary: summarizeOutput(output),
  };
}

function summarizeOutput(output) {
  if (!output) return "";

  const lines = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith("> night-economy@"));

  const important = lines.filter(line =>
    /passed|failed|missing|placeholder|could not start|must be set|must look like|service-role|Warnings do not block|Next step/i.test(
      line,
    ),
  );

  return (important.length ? important : lines.slice(-2)).slice(0, 4).join(" ");
}
