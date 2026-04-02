# FlipFlag CLI

**FlipFlag CLI** is a lightweight command-line tool for managing feature flags and tracking development tasks directly in your repository.  

## Key Features

- 📋 **Task Management**: Start work sessions and track progress
- 🔄 **Flag Synchronization**: Upload feature flags to FlipFlag platform
- 🌿 **Git Integration**: Automatically create/switch Git branches
- 👥 **Team Collaboration**: Store contributor information from Git
- 🚀 **CI/CD Ready**: Integrate with GitLab, GitHub Actions, CircleCI, and more

FlipFlag CLI stores all data in a local `.flipflag.yml` file, making it easy to version control your feature flags alongside your code.

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
```

---

## 🧭 Commands

FlipFlag CLI provides two main commands:

1. **`start`** - Start working on a task
2. **`sync`** - Upload feature flags to FlipFlag API

---

### ▶️ Start a Task

```bash
flipflag start TASK-1
```

If `TASK-ID` is missing, the CLI will ask you to enter it interactively.

During startup, you may be prompted to choose:

- task type (`feature` or `bugfix`)
- whether to create/switch to a Git branch

### Start with flags (non-interactive)

```bash
flipflag start TASK-2 --type=bugfix --branch
```

---

## 🌿 Git Branching Rules

If the `--branch` flag is enabled:

- `feature` → creates/uses branch: `feature/TASK-ID`
- `bugfix` → creates/uses branch: `bugfix/TASK-ID`

Behavior:

- if branch exists → switches to it
- if branch does not exist → creates it and switches to it

---

## 🧩 Start Command Flags

| Flag | Description |
|------|-------------|
| `--type=feature` / `--type=bugfix` | Task type |
| `--branch` | Create/switch Git branch |
| `--no-branch` | Do not touch Git branches |

---

## 🔄 Sync Command

Upload feature flags from `.flipflag.yml` to FlipFlag platform:

```bash
flipflag sync --private-key "your_private_key"
```

### Using Environment Variables (Recommended)

```bash
export FLIPFLAG_PRIVATE_KEY="your_private_key"
flipflag sync
```

### Sync Command Options

| Option | Environment Variable | Description | Required |
|--------|---------------------|-------------|----------|
| `--private-key KEY` | `FLIPFLAG_PRIVATE_KEY` | Private API key | ✅ Yes |
| `--public-key KEY` | `FLIPFLAG_PUBLIC_KEY` | Public API key | ❌ No |
| `--api-url URL` | `FLIPFLAG_API_URL` | API endpoint | ❌ No |
| `--config PATH` | - | Config file path | ❌ No |

### Sync Examples

```bash
# Basic sync
export FLIPFLAG_PRIVATE_KEY="priv_abc123..."
flipflag sync

# Custom config file
flipflag sync --config .flipflag.production.yml

# Self-hosted API
flipflag sync --api-url "https://flipflag.your-company.com"
```

### CI/CD Integration

**GitLab CI/CD:**

```yaml
sync-features:
  stage: sync
  image: node:20-alpine
  only:
    - main
  script:
    - npm install -g @flipflag/cli
    - flipflag sync --private-key "$FLIPFLAG_PRIVATE_KEY"
```

**GitHub Actions:**

```yaml
- name: Sync Feature Flags
  run: |
    npm install -g @flipflag/cli
    flipflag sync --private-key "${{ secrets.FLIPFLAG_PRIVATE_KEY }}"
```

📚 **Complete CI/CD Guide**: See [CLI_SYNC.md](../docs/CLI_SYNC.md) for detailed integration examples with GitLab, GitHub Actions, CircleCI, Jenkins, and Azure Pipelines.

---

## 🆘 Help

```bash
flipflag help
```

---

## 📌 Examples

### Typical workflow

```bash
flipflag start TASK-10 --type=feature --branch
```

### Create a task without a branch

```bash
flipflag start TASK-21 --no-branch
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

## 📚 Documentation

- **[Feature Flag Sync Guide](../docs/CLI_SYNC.md)** - Complete guide for syncing flags and CI/CD integration
- **[CI/CD Examples](../docs/examples/)** - Ready-to-use configurations for various platforms
- **[FlipFlag SDK](https://github.com/flipflag-dev/sdk)** - Client SDK for feature flag management

---

## 🔗 Links

- **Website**: https://flipflag.dev
- **Dashboard**: https://cloud.flipflag.dev
- **Documentation**: https://docs.flipflag.dev
- **GitHub**: https://github.com/flipflag-dev/cli
- **NPM**: https://www.npmjs.com/package/@flipflag/cli

---

## 📝 License

MIT

---

**Made with ❤️ by the FlipFlag team**
