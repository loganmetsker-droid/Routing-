# How to Launch - Correct Commands

## The Right Way to Launch in Git Bash / Terminal

### Method 1: Navigate First, Then Launch (RECOMMENDED)

```bash
# Step 1: Navigate to project directory
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project

# Step 2: Verify you're in the right place
pwd
# Should show: /c/Users/lmets/OneDrive/Desktop/my-awesome-project

# Step 3: Launch with Docker Compose
docker compose up -d

# Step 4: View logs (optional)
docker compose logs -f
```

### Method 2: Use the Shell Script (Linux/Mac/Git Bash)

```bash
# Navigate to project first
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project

# Run the shell script
./start.sh
```

### Method 3: All-in-One Command

```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project && docker compose up -d
```

## For Windows Command Prompt (CMD)

```cmd
cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project
docker compose up -d
```

## For PowerShell

```powershell
cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project
docker compose up -d
```

## Why Your Command Failed

You tried:
```bash
C:UserslmetsOneDriveDesktopmy-awesome-projectstart.bat
```

**Problems:**
1. Missing slashes (`/` or `\`)
2. In Git Bash, use `/c/Users/...` not `C:\Users\...`
3. `.bat` files don't run directly in Git Bash (they're for CMD/PowerShell)

## The Fix

**In Git Bash, use this:**
```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project
docker compose up -d
```

**In Windows CMD, use this:**
```cmd
cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project
docker compose up -d
```

## Quick Reference

| Terminal Type | Path Format | Example |
|--------------|-------------|---------|
| Git Bash | `/c/Users/...` | `cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project` |
| CMD | `C:\Users\...` | `cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project` |
| PowerShell | `C:\Users\...` | `cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project` |
| Linux/Mac | `/home/...` or `~/...` | `cd ~/Desktop/my-awesome-project` |

## After Successful Launch

Access the application at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api
- GraphQL: http://localhost:3000/graphql

## Stop the Application

```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project
docker compose down
```

## Check Status

```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project
docker compose ps
```

---

**TIP**: Bookmark this directory in your terminal for easy access!

In Git Bash, you can add this to your `~/.bashrc`:
```bash
alias myproject="cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project"
```

Then just type: `myproject` to navigate there instantly!
