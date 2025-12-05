# FlipFlag CLI

**Flipflag** is a lightweight CLI tool for tracking development tasks directly inside your repository.  
It stores data in a local `.flipflag.yml` file and allows you to:

- start and stop work sessions,
- track time,
- automatically create/switch Git branches,
- store contributor information from Git.

Flipflag is designed as a minimal, developer-friendly alternative to larger issue/time-tracking systems.

---

## 🚀 Installation

Install globally:

```bash
npm install -g @flipflag/cli
```

Or install locally:

```bash
npm install @flipflag/cli --save-dev
```

Run with:

```bash
flipflag
```

---

## 📄 `.flipflag.yml` Format

This file is created automatically when you run the first `flipflag start` command.

Example:

```yaml
TASK-1:
  description: ""
  contributor: "dev@example.com"
  type: "feature"
  times:
    - started: "2025-01-01T10:00:00.000Z"
      finished: "2025-01-01T12:30:00.000Z"
    - started: "2025-01-02T09:00:00.000Z"
      finished: null
```

---

## 🧭 Usage

### ▶️ Start a Task

```bash
flipflag start TASK-1
```

If `TASK-ID` is missing, the CLI will ask you to enter it interactively.

During startup, you may be prompted to choose:

- task type (`feature` or `bugfix`)
- whether to create/switch to a Git branch
- whether to enable time tracking

### Start with flags (non-interactive)

```bash
flipflag start TASK-2 --type=bugfix --branch --time
```

### Start without time tracking

```bash
flipflag start TASK-3 --no-time
```

---

## ⏹ Stop a Task

Stops the last open time interval:

```bash
flipflag stop TASK-1
```

If the ID is omitted, you will be asked to enter it.

---

## 🌿 Git Branching Rules

If the `--branch` flag is enabled:

- `feature` → creates/uses branch: `feature/TASK-ID`
- `bugfix` → creates/uses branch: `bugfix/TASK-ID`

Behavior:

- if branch exists → switches to it
- if branch does not exist → creates it and switches to it

---

## 🕒 Time Tracking

If `--time` is enabled, then `flipflag start` will:

1. create a time entry with `{ started, finished: null }`;
2. **wait until you press Enter**;
3. write the `finished` timestamp.

Example:

```bash
flipflag start TASK-5
# ...work...
# press Enter to stop tracking
```

---

## 🧩 Start Command Flags

| Flag | Description |
|------|-------------|
| `--type=feature` / `--type=bugfix` | Task type |
| `--branch` | Create/switch Git branch |
| `--no-branch` | Do not touch Git branches |
| `--time` | Enable time tracking |
| `--no-time` | Disable time tracking |

---

## 🛠 Stop Command

```bash
flipflag stop TASK-ID
```

Closes the latest unfinished time interval.

---

## 🆘 Help

```bash
flipflag help
```

---

## 📌 Examples

### Typical workflow

```bash
flipflag start TASK-10 --type=feature --branch --time
# press Enter when done...
flipflag stop TASK-10
```

### Create a task without time tracking

```bash
flipflag start TASK-21 --no-time --no-branch
```

---

## 🔧 Environment Variables

If Git email is not configured, Flipflag will use:

```
FLIPFLAG_USER="myname@example.com"
```

---

## 📦 Using Locally via `npx`

```bash
npx flipflag start TASK-1
```

---

## 📝 License

MIT