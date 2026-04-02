#!/usr/bin/env node

import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import prompts from "prompts";
import { execSync } from "child_process";

const TASKS_FILE = path.join(process.cwd(), ".flipflag.yml");
const DEFAULT_API_URL = "https://api.flipflag.dev";

type TaskType = "feature" | "bugfix" | string;

interface Task {
  description: string;
  contributor: string;
  type?: TaskType;
}

type Tasks = Record<string, Task>;

// ==== helpers for working with file ====

function loadTasks(): Tasks {
  if (!fs.existsSync(TASKS_FILE)) return {};
  const content = fs.readFileSync(TASKS_FILE, "utf8");
  if (!content.trim()) return {};
  return (yaml.load(content) as Tasks) || {};
}

function saveTasks(tasks: Tasks) {
  const yamlStr = yaml.dump(tasks, { lineWidth: 120 });
  fs.writeFileSync(TASKS_FILE, yamlStr, "utf8");
}

// ==== git helpers ====

function getGitEmail(): string {
  try {
    const email = execSync("git config user.email", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();

    if (email) return email;
  } catch {
    // ignore, fallback below
  }

  return process.env.FLIPFLAG_USER || "";
}

// ==== git branches logic ====

function createBranchIfNeeded(taskId: string, type: TaskType) {
  const branchName = `${type === "bugfix" ? "bugfix" : "feature"}/${taskId}`;

  try {
    // check if branch exists
    const existing = execSync(`git branch --list "${branchName}"`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (existing) {
      console.log(`Switching to existing branch ${branchName}`);
      execSync(`git checkout "${branchName}"`, { stdio: "inherit" });
    } else {
      console.log(`Creating and switching to branch ${branchName}`);
      execSync(`git checkout -b "${branchName}"`, { stdio: "inherit" });
    }
  } catch (e: any) {
    console.warn("Failed to create/switch git branch:", e.message);
  }
}

// ==== commands ====

async function cmdStart(argv: string[]) {
  const [, , , maybeId, ...rest] = argv;
  let taskId = maybeId && !maybeId.startsWith("-") ? maybeId : null;

  // simple flags parser
  const flags: {
    type: TaskType | null;
    branch: boolean | null;
  } = {
    type: null,
    branch: null,
  };

  rest.forEach((arg) => {
    if (arg === "--branch") flags.branch = true;
    if (arg === "--no-branch") flags.branch = false;
    if (arg.startsWith("--type=")) flags.type = arg.split("=")[1];
  });

  const questions: prompts.PromptObject[] = [];

  if (!taskId) {
    questions.push({
      type: "text",
      name: "taskId",
      message: "Task ID (e.g. TASK-1):",
    });
  }

  if (!flags.type) {
    questions.push({
      type: "select",
      name: "type",
      message: "Task type:",
      choices: [
        { title: "feature", value: "feature" },
        { title: "bugfix", value: "bugfix" },
      ],
      initial: 0,
    });
  }

  if (flags.branch === null) {
    questions.push({
      type: "toggle",
      name: "branch",
      message: "Create/switch to branch?",
      initial: true,
      active: "yes",
      inactive: "no",
    });
  }

  const answers = questions.length ? await prompts(questions) : {};

  if (!taskId) taskId = (answers as any).taskId;
  if (!taskId) {
    console.error("Task ID is required");
    process.exit(1);
  }

  const type: TaskType = flags.type || (answers as any).type || "feature";
  const createBranch =
    flags.branch !== null ? flags.branch : (answers as any).branch;

  // === main logic ===
  const tasks = loadTasks();

  if (!tasks[taskId]) {
    tasks[taskId] = {
      description: "",
      contributor: getGitEmail(),
      type,
    };
    console.log(`Creating new task ${taskId}`);
  } else {
    // if task already exists, we can update type if it's empty
    if (!tasks[taskId].type) tasks[taskId].type = type;
    if (!tasks[taskId].contributor) tasks[taskId].contributor = getGitEmail();
    console.log(`Continuing work on task ${taskId}`);
  }

  saveTasks(tasks);

  if (createBranch) {
    createBranchIfNeeded(taskId, type);
  }
}

async function cmdSync(argv: string[]) {
  const args = argv.slice(3);

  // Parse flags
  let publicKey: string | undefined;
  let privateKey: string | undefined;
  let apiUrl = DEFAULT_API_URL;
  let configPath = TASKS_FILE;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--public-key" && args[i + 1]) {
      publicKey = args[++i];
    } else if (arg === "--private-key" && args[i + 1]) {
      privateKey = args[++i];
    } else if (arg === "--api-url" && args[i + 1]) {
      apiUrl = args[++i];
    } else if (arg === "--config" && args[i + 1]) {
      configPath = args[++i];
    }
  }

  // Fallback to environment variables
  publicKey = publicKey || process.env.FLIPFLAG_PUBLIC_KEY;
  privateKey = privateKey || process.env.FLIPFLAG_PRIVATE_KEY;
  apiUrl = process.env.FLIPFLAG_API_URL || apiUrl;

  if (!privateKey) {
    console.error("Error: Private key is required for sync operation");
    console.error(
      "Provide it via --private-key flag or FLIPFLAG_PRIVATE_KEY environment variable",
    );
    process.exit(1);
  }

  if (!fs.existsSync(configPath)) {
    console.error(`Error: Config file not found at ${configPath}`);
    process.exit(1);
  }

  // Load tasks from YAML
  const content = fs.readFileSync(configPath, "utf8");
  if (!content.trim()) {
    console.log("No features to sync (config file is empty)");
    return;
  }

  const tasks = (yaml.load(content) as Tasks) || {};
  const featureNames = Object.keys(tasks);

  if (featureNames.length === 0) {
    console.log("No features to sync");
    return;
  }

  console.log(`Syncing ${featureNames.length} feature(s) to ${apiUrl}...`);

  const baseUrl = apiUrl.replace(/\/+$/, "");
  let successCount = 0;
  let errorCount = 0;

  for (const [featureName, task] of Object.entries(tasks)) {
    try {
      const url = `${baseUrl}/v1/sdk/feature`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureName,
          privateKey,
          contributor: task.contributor || "",
        }),
      });

      if (response.ok) {
        console.log(`✓ ${featureName}`);
        successCount++;
      } else {
        const errorText = await response.text();
        console.error(`✗ ${featureName}: ${response.status} - ${errorText}`);
        errorCount++;
      }
    } catch (e: any) {
      console.error(`✗ ${featureName}: ${e.message}`);
      errorCount++;
    }
  }

  console.log("");
  console.log(`Sync complete: ${successCount} succeeded, ${errorCount} failed`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
flipflag — simple task tracker using .flipflag.yml file

Usage:
  flipflag start [TASK-ID] [--type=feature|bugfix] [--branch|--no-branch]
  flipflag sync [--private-key KEY] [--public-key KEY] [--api-url URL] [--config PATH]

Commands:
  start    Start working on a task
  sync     Upload feature flags to FlipFlag API

Sync Options:
  --private-key KEY    Private key for authentication (or set FLIPFLAG_PRIVATE_KEY)
  --public-key KEY     Public key (optional, or set FLIPFLAG_PUBLIC_KEY)
  --api-url URL        API endpoint (default: https://api.flipflag.dev)
  --config PATH        Path to config file (default: .flipflag.yml)

Behavior:
  - contributor is taken from "git config user.email" (fallback: FLIPFLAG_USER env or empty string)

Examples:
  flipflag start TASK-2 --type=feature --branch
  flipflag start TASK-3 --type=bugfix --no-branch
`);
}

// ==== router ====

(async function main() {
  const [, , cmd] = process.argv;

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }

  if (cmd === "start") {
    await cmdStart(process.argv);
  } else if (cmd === "sync") {
    await cmdSync(process.argv);
  } else {
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exit(1);
  }
})();
