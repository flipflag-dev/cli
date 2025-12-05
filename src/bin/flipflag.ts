#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import prompts from 'prompts';
import { execSync } from 'child_process';

const TASKS_FILE = path.join(process.cwd(), '.flipflag.yml');

type TaskType = 'feature' | 'bugfix' | string;

interface TaskTime {
  started: string;
  finished: string | null;
}

interface Task {
  description: string;
  contributor: string;
  type?: TaskType;
  times?: TaskTime[];
}

type Tasks = Record<string, Task>;

// ==== helpers for working with file ====

function loadTasks(): Tasks {
  if (!fs.existsSync(TASKS_FILE)) return {};
  const content = fs.readFileSync(TASKS_FILE, 'utf8');
  if (!content.trim()) return {};
  return (yaml.load(content) as Tasks) || {};
}

function saveTasks(tasks: Tasks) {
  const yamlStr = yaml.dump(tasks, { lineWidth: 120 });
  fs.writeFileSync(TASKS_FILE, yamlStr, 'utf8');
}

// ==== git helpers ====

function getGitEmail(): string {
  try {
    const email = execSync('git config user.email', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();

    if (email) return email;
  } catch {
    // ignore, fallback below
  }

  return process.env.FLIPFLAG_USER || '';
}

// ==== git branches logic ====

function createBranchIfNeeded(taskId: string, type: TaskType) {
  const branchName = `${type === 'bugfix' ? 'bugfix' : 'feature'}/${taskId}`;

  try {
    // check if branch exists
    const existing = execSync(`git branch --list "${branchName}"`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (existing) {
      console.log(`Switching to existing branch ${branchName}`);
      execSync(`git checkout "${branchName}"`, { stdio: 'inherit' });
    } else {
      console.log(`Creating and switching to branch ${branchName}`);
      execSync(`git checkout -b "${branchName}"`, { stdio: 'inherit' });
    }
  } catch (e: any) {
    console.warn('Failed to create/switch git branch:', e.message);
  }
}

// ==== commands ====

async function cmdStart(argv: string[]) {
  const [, , , maybeId, ...rest] = argv;
  let taskId = maybeId && !maybeId.startsWith('-') ? maybeId : null;

  // simple flags parser
  const flags: {
    type: TaskType | null;
    branch: boolean | null;
    time: boolean | null;
  } = {
    type: null,
    branch: null,
    time: null,
  };

  rest.forEach((arg) => {
    if (arg === '--branch') flags.branch = true;
    if (arg === '--no-branch') flags.branch = false;
    if (arg === '--time') flags.time = true;
    if (arg === '--no-time') flags.time = false;
    if (arg.startsWith('--type=')) flags.type = arg.split('=')[1];
  });

  const questions: prompts.PromptObject[] = [];

  if (!taskId) {
    questions.push({
      type: 'text',
      name: 'taskId',
      message: 'Task ID (e.g. TASK-1):',
    });
  }

  if (!flags.type) {
    questions.push({
      type: 'select',
      name: 'type',
      message: 'Task type:',
      choices: [
        { title: 'feature', value: 'feature' },
        { title: 'bugfix', value: 'bugfix' },
      ],
      initial: 0,
    });
  }

  if (flags.branch === null) {
    questions.push({
      type: 'toggle',
      name: 'branch',
      message: 'Create/switch to branch?',
      initial: true,
      active: 'yes',
      inactive: 'no',
    });
  }

  if (flags.time === null) {
    questions.push({
      type: 'toggle',
      name: 'time',
      message: 'Track time?',
      initial: true,
      active: 'yes',
      inactive: 'no',
    });
  }

  const answers = questions.length ? await prompts(questions) : {};

  if (!taskId) taskId = (answers as any).taskId;
  if (!taskId) {
    console.error('Task ID is required');
    process.exit(1);
  }

  const type: TaskType = flags.type || (answers as any).type || 'feature';
  const createBranch =
    flags.branch !== null ? flags.branch : (answers as any).branch;
  const trackTime = flags.time !== null ? flags.time : (answers as any).time;

  // === main logic ===
  const tasks = loadTasks();

  if (!tasks[taskId]) {
    tasks[taskId] = {
      description: '',
      contributor: getGitEmail(),
      type,
      times: [],
    };
    console.log(`Creating new task ${taskId}`);
  } else {
    // if task already exists, we can update type if it's empty
    if (!tasks[taskId].type) tasks[taskId].type = type;
    if (!tasks[taskId].contributor) tasks[taskId].contributor = getGitEmail();
    console.log(`Continuing work on task ${taskId}`);
  }

  if (trackTime) {
    const now = new Date().toISOString();
    tasks[taskId].times = tasks[taskId].times || [];
    tasks[taskId].times!.push({
      started: now,
      finished: null,
    });
    console.log(`Started work on task ${taskId} at ${now}`);
  }

  saveTasks(tasks);

  if (createBranch) {
    createBranchIfNeeded(taskId, type);
  }

  // === waiting mode when time tracking is enabled ===
  if (trackTime) {
    console.log('');
    console.log(`Time tracking is active for task ${taskId}.`);
    console.log('Press Enter when you want to stop tracking...');

    await new Promise<void>((resolve) => {
      process.stdin.resume();
      process.stdin.once('data', () => {
        resolve();
      });
    });

    const now = new Date().toISOString();

    const updatedTasks = loadTasks();
    const task = updatedTasks[taskId];

    if (!task) {
      console.error(`Task ${taskId} not found while stopping`);
      process.exit(1);
    }

    const times = task.times || [];
    const last = [...times].reverse().find((t) => !t.finished);

    if (!last) {
      console.error(`Task ${taskId} has no open time interval to stop`);
      process.exit(1);
    }

    last.finished = now;
    task.times = times;
    updatedTasks[taskId] = task;
    saveTasks(updatedTasks);

    console.log(`Stopped work on task ${taskId} at ${now}`);
  }
}

async function cmdStop(argv: string[]) {
  const [, , , maybeId] = argv;
  let taskId = maybeId && !maybeId.startsWith('-') ? maybeId : null;

  if (!taskId) {
    const ans = await prompts({
      type: 'text',
      name: 'taskId',
      message: 'Task ID to stop:',
    });
    taskId = (ans as any).taskId;
  }

  if (!taskId) {
    console.error('Task ID is required');
    process.exit(1);
  }

  const tasks = loadTasks();
  const task = tasks[taskId];

  if (!task) {
    console.error(`Task ${taskId} not found`);
    process.exit(1);
  }

  const times = task.times || [];
  const last = [...times].reverse().find((t) => !t.finished);

  if (!last) {
    console.error(`Task ${taskId} has no open time interval`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  last.finished = now;

  // rewrite times (since last is a reference to an object in the array, we could skip this)
  task.times = times;
  tasks[taskId] = task;
  saveTasks(tasks);

  console.log(`Stopped work on task ${taskId} at ${now}`);
}

function printHelp() {
  console.log(`
flipflag — simple task tracker using .flipflag.yml file

Usage:
  flipflag start [TASK-ID] [--type=feature|bugfix] [--branch|--no-branch] [--time|--no-time]
  flipflag stop [TASK-ID]

Behavior:
  - contributor is taken from "git config user.email" (fallback: FLIPFLAG_USER env or empty string)
  - If time tracking is enabled, "start" will keep running and wait until you press Enter,
    then it will set "finished" for the last interval.
  - If time tracking is disabled, "start" behaves as a simple task initializer and exits immediately.

Examples:
  flipflag start TASK-2 --type=feature --branch --time
  flipflag start TASK-3 --type=bugfix --no-time
  flipflag stop TASK-2
`);
}

// ==== router ====

(async function main() {
  const [, , cmd] = process.argv;

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }

  if (cmd === 'start') {
    await cmdStart(process.argv);
  } else if (cmd === 'stop') {
    await cmdStop(process.argv);
  } else {
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exit(1);
  }
})();
