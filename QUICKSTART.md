# Quick Start Guide

## The Problem You Encountered

You got an error because npm was run from the wrong directory (`C:\Users\lmets\` instead of the project directory).

## The Solution

We've created launch scripts that automatically navigate to the correct directory.

## How to Launch the Application

### Option 1: Using the Launch Script (Easiest)

**On Windows:**
```bash
# Double-click this file in File Explorer:
start.bat

# Or from any directory in terminal:
"C:\Users\lmets\OneDrive\Desktop\my-awesome-project\start.bat"
```

**On Linux/Mac:**
```bash
# From any directory:
/c/Users/lmets/OneDrive/Desktop/my-awesome-project/start.sh

# Or navigate first:
cd ~/Desktop/my-awesome-project
./start.sh
```

### Option 2: Manual Docker Compose (Traditional)

```bash
# IMPORTANT: Navigate to project directory first!
cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project

# Then run:
docker compose up -d
```

### Option 3: Local Development (Without Docker)

```bash
# IMPORTANT: Always navigate to project directory first!
cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project

# Start backend
cd backend
npm install
npm run start:dev

# In another terminal, start frontend
cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project\frontend
npm install
npm run dev
```

## After Launch

Once services are running, access:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **GraphQL Playground**: http://localhost:3000/graphql
- **Health Check**: http://localhost:3000/health

## Common Commands

```bash
# Always navigate to project directory first!
cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project

# View logs
docker compose logs -f

# Stop services
docker compose down

# Restart services
docker compose restart

# Rebuild and restart
docker compose up -d --build
```

## Why the Error Happened

The error `ENOENT: no such file or directory, open 'C:\Users\lmets\package.json'` occurred because:

1. You ran an npm command from `C:\Users\lmets\` directory
2. npm looks for `package.json` in the current directory
3. There's no `package.json` in your home directory
4. The actual project is in `C:\Users\lmets\OneDrive\Desktop\my-awesome-project`

## Prevention

**Always do one of these:**

1. **Use the launch script** (it handles navigation automatically)
2. **Navigate to project directory first** before running any commands
3. **Use full paths** in your commands

## Verification

To check you're in the right directory:

```bash
# Should show: C:\Users\lmets\OneDrive\Desktop\my-awesome-project
pwd

# Should list: backend, frontend, docker-compose.yml, etc.
ls
```

## Need Help?

If you still have issues:

1. Make sure Docker Desktop is running
2. Check you're in the correct directory (`pwd` command)
3. Verify Docker Compose is installed: `docker compose version`
4. Check the logs: `docker compose logs`

---

**Remember**: The `start.bat` or `start.sh` script is the easiest way - it handles everything automatically!
