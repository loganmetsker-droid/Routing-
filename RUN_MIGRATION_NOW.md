# 🚀 RUN THIS MIGRATION NOW (2 Minutes)

Your backend is timing out because the database needs Phase 3 columns.

## ✅ EASIEST METHOD: Render Shell

### Step 1: Open Render Shell (30 seconds)
1. Go to: https://dashboard.render.com
2. Find service: **routing-dispatch-backend**
3. Click on it
4. Click **"Shell"** tab on the left sidebar

### Step 2: Run Migration (1 minute)
Copy and paste this ENTIRE command into the shell:

```bash
node run-migration.js
```

Press Enter and wait ~5-10 seconds.

### Step 3: Verify Success
You should see:
```
Connecting to database...
Connected ✅
Running migration...
Adding columns to jobs table...
Migration completed successfully ✅

Verifying migration...
New columns found: 5
  - start_date (timestamp with time zone)
  - end_date (timestamp with time zone)
  - billing_status (character varying)
  - customer_id (uuid)
  - archived_at (timestamp with time zone)
✅ Customers table created

✅ Phase 3 database migration complete!
```

### Step 4: Redeploy Backend (30 seconds)
1. Go back to Render dashboard
2. Click **"Manual Deploy"**
3. Select **"Deploy latest commit"**
4. Wait 2-3 minutes for deployment

### Step 5: Test (30 seconds)
Open this URL in your browser:
```
https://routing-dispatch-backend.onrender.com/health
```

Should return:
```json
{"status":"ok","info":{"database":{"status":"up"}}}
```

---

## 🎉 DONE!

Then test your frontend:
**https://frontend-seven-mu-49.vercel.app**

You should see:
- ✅ Calendar tab with jobs
- ✅ Multi-day jobs spanning multiple days
- ✅ Colored status indicators
- ✅ Billing status (paid/unpaid borders)
- ✅ Customer search
- ✅ Job cloning

---

## 🐛 IF IT DOESN'T WORK

### "run-migration.js not found"
The file exists in your GitHub repo. Render should have it. Try:
```bash
ls -la run-migration.js
```

If not found:
```bash
git pull
node run-migration.js
```

### "Migration failed: connection error"
Your DATABASE_URL in Render env vars might be wrong. Check:
1. Render dashboard → routing-dispatch-backend → Environment
2. Look for DATABASE_URL variable
3. Should start with `postgresql://`

### "Column already exists"
That's OK! The migration uses `IF NOT EXISTS`, so it's safe to run multiple times.

### Backend still timing out after migration
1. Check Render logs for errors
2. Make sure you clicked "Manual Deploy" after migration
3. Wait full 3 minutes for deployment to complete

---

## ⚡ ALTERNATIVE: Run Locally Against Production DB

If Render Shell doesn't work:

### Step 1: Get DATABASE_URL
1. Render dashboard → routing-dispatch-backend → Environment
2. Copy the `DATABASE_URL` value
3. Should look like: `postgresql://user:pass@host.com:5432/dbname`

### Step 2: Run Migration Locally
```bash
cd backend
DATABASE_URL="paste_your_url_here" node run-migration.js
```

### Step 3: Redeploy Render
Same as above - Manual Deploy

---

## 📊 WHAT THE MIGRATION DOES

**Adds to `jobs` table**:
- start_date (multi-day jobs)
- end_date (multi-day jobs)
- billing_status (paid/unpaid)
- billing_amount (dollar amount)
- billing_notes (internal notes)
- invoice_ref (invoice number)
- customer_id (link to customers)
- archived_at (archive timestamp)

**Creates `customers` table**:
- Full CRUD for customer management
- Structured addresses
- Job history tracking

**Adds indexes** for performance

---

## ✅ SUCCESS = Backend Health Returns OK

When this works:
```bash
curl https://routing-dispatch-backend.onrender.com/health
```

Returns:
```json
{"status":"ok"}
```

Then Phase 3 is LIVE! 🎉
