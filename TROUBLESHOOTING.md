# Troubleshooting Guide

## Error: "open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified"

### What This Means
Docker Desktop is not running on your computer.

### Solution

#### Step 1: Start Docker Desktop

**Method 1 - Windows Start Menu (Recommended):**
1. Click the Windows Start button (or press Windows key)
2. Type: `Docker Desktop`
3. Click on "Docker Desktop" when it appears
4. Wait 30-60 seconds for Docker to start

**Method 2 - Desktop Shortcut:**
- Double-click the Docker Desktop icon on your desktop (if you have one)

**Method 3 - File Explorer:**
- Navigate to: `C:\Program Files\Docker\Docker\`
- Double-click: `Docker Desktop.exe`

#### Step 2: Wait for Docker to Be Ready

Watch the system tray (bottom-right corner of Windows taskbar):
- 🐋 The Docker whale icon will appear
- Wait until it **stops animating** (becomes steady)
- Hover over it - tooltip should say "Docker Desktop is running"

This usually takes **30-60 seconds**.

#### Step 3: Verify Docker is Running

In Git Bash, run:
```bash
docker info
```

**If you see:**
- System information → ✓ Docker is ready!
- Error message → Wait a bit longer, then try again

#### Step 4: Launch the Application

Now you can run:
```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project && docker compose up -d
```

**OR use the smart launcher (checks Docker automatically):**
```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project && ./launch.sh
```

---

## Other Common Issues

### Issue: Docker Desktop Won't Start

**Possible Solutions:**

1. **Check if Docker is already running:**
   - Look for the whale icon in system tray
   - If it's there but grayed out, right-click → Restart

2. **Restart your computer:**
   - Sometimes Windows needs a fresh start
   - Docker Desktop will auto-start after reboot (if enabled)

3. **Check Windows Services:**
   - Press `Win + R`
   - Type: `services.msc`
   - Look for "Docker Desktop Service"
   - Right-click → Start (if stopped)

4. **Reinstall Docker Desktop:**
   - Download from: https://www.docker.com/products/docker-desktop
   - Run the installer
   - Restart your computer

### Issue: "version is obsolete" Warning

**The Warning:**
```
level=warning msg="version` is obsolete"
```

**What It Means:**
- This is just a cosmetic warning
- Docker Compose v2 doesn't need the `version:` field anymore
- Everything still works fine

**To Remove (Optional):**
Edit `docker-compose.yml` and delete the first line:
```yaml
version: '3.8'  ← Delete this line
```

### Issue: Port Already in Use

**Error:**
```
bind: address already in use
```

**Solution:**

1. **Check what's using the port:**
   ```bash
   netstat -ano | findstr :5173  # For frontend
   netstat -ano | findstr :3000  # For backend
   ```

2. **Stop the conflicting service:**
   - Stop your local dev servers
   - Or change ports in `.env` file

3. **Or use different ports:**
   Edit `.env`:
   ```bash
   FRONTEND_PORT=5174
   BACKEND_PORT=3001
   ```

### Issue: Out of Memory

**Error:**
```
docker: Error response from daemon: OOM
```

**Solution:**

1. **Increase Docker memory:**
   - Open Docker Desktop
   - Settings → Resources → Advanced
   - Increase Memory to at least 4GB
   - Click "Apply & Restart"

2. **Close other applications:**
   - Free up RAM
   - Close unnecessary programs

### Issue: Services Won't Start

**Check service status:**
```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project
docker compose ps
```

**View service logs:**
```bash
docker compose logs backend
docker compose logs frontend
docker compose logs postgres
```

**Restart specific service:**
```bash
docker compose restart backend
```

**Full reset:**
```bash
docker compose down
docker compose up -d --build
```

---

## Quick Commands Reference

### Check if Docker is Running
```bash
docker info
```

### Start Docker Desktop (Windows)
```bash
start /c/Program\ Files/Docker/Docker/Docker\ Desktop.exe
```

### Launch Application
```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project
docker compose up -d
```

### Stop Application
```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project
docker compose down
```

### View All Logs
```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project
docker compose logs -f
```

### View Specific Service Logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

### Check Service Status
```bash
docker compose ps
```

### Restart Services
```bash
docker compose restart
```

### Full Reset (Clean Start)
```bash
docker compose down -v  # Warning: Deletes database data!
docker compose up -d --build
```

---

## Still Having Issues?

### Create an Alias for Easy Access

Add this to `~/.bashrc`:
```bash
alias project="cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project"
alias project-start="cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project && ./launch.sh"
alias project-stop="cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project && docker compose down"
alias project-logs="cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project && docker compose logs -f"
```

Then reload:
```bash
source ~/.bashrc
```

Now you can just type:
- `project-start` → Launch application
- `project-stop` → Stop application
- `project-logs` → View logs
- `project` → Navigate to project

---

## Contact Support

If you're still stuck:
1. Check the logs: `docker compose logs`
2. Create an issue with the error message
3. Include your OS version and Docker Desktop version

---

**Remember**: Docker Desktop must be running BEFORE you can use `docker compose`!
