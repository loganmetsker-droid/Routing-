# Phase 3 Option B - Final Deployment Steps

## ✅ COMPLETED

1. **Vercel Environment Variables Updated** ✅
   - `VITE_API_URL` → `https://routing-dispatch-backend.onrender.com`
   - `VITE_GRAPHQL_URL` → `https://routing-dispatch-backend.onrender.com/graphql`
   - `VITE_WS_URL` → `wss://routing-dispatch-backend.onrender.com`

2. **Frontend Redeployed** ✅
   - URL: https://frontend-seven-mu-49.vercel.app
   - Now pointing to Render backend

3. **Backend Code Deployed** ✅
   - URL: https://routing-dispatch-backend.onrender.com
   - Currently timing out (needs database migration)

---

## ⚠️ REQUIRED: Database Migration

**Problem**: Backend is crashing because the database is missing Phase 3 columns.

**Your database**: Railway Postgres 14
**Backend**: Render (https://routing-dispatch-backend.onrender.com)

### **Step 1: Run Migration on Railway Database** ⏱️ 2-3 minutes

**Migration File**: `backend/migrations/add-job-workflow-fields.sql`

**Option A: Railway Dashboard** (Easiest)
1. Go to: https://railway.com/project/lucid-blessing
2. Find your **Postgres** service (not the backend service)
3. Click "Data" or "Query" tab
4. Open: `backend/migrations/add-job-workflow-fields.sql` in a text editor
5. Copy the entire SQL content
6. Paste into Railway query editor
7. Execute
8. Verify: You should see "ALTER TABLE" success messages

**Option B: Get Connection String**
1. Railway dashboard → Postgres service → Variables
2. Copy `DATABASE_URL`
3. Use pgAdmin, DBeaver, or psql:
   ```bash
   psql "YOUR_DATABASE_URL" -f backend/migrations/add-job-workflow-fields.sql
   ```

**What the migration does**:
- Adds `start_date`, `end_date` to jobs table (multi-day jobs)
- Adds `billing_status`, `billing_amount`, `billing_notes`, `invoice_ref` (billing tracking)
- Adds `customer_id`, `archived_at` (customer management)
- Creates `customers` table
- Adds performance indexes

**Verification**:
```sql
-- Run this query to verify columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name='jobs'
AND column_name IN ('start_date', 'end_date', 'billing_status', 'customer_id');
```
Should return 4 rows.

---

### **Step 2: Restart Render Backend** ⏱️ 1 minute

After migration completes:

1. Go to: https://dashboard.render.com
2. Find your backend service: `routing-dispatch-backend`
3. Click "Manual Deploy" → "Deploy latest commit"

OR trigger via git:
```bash
cd backend
git commit --allow-empty -m "chore: Trigger redeploy after migration"
git push
```

Wait 2-3 minutes for deployment to complete.

---

### **Step 3: Verify Backend** ⏱️ 1 minute

**Test health endpoint**:
```bash
curl https://routing-dispatch-backend.onrender.com/health
```
✅ Expected: `{"status":"ok","info":{"database":{"status":"up"}}}`

**Test GraphQL**:
```bash
curl https://routing-dispatch-backend.onrender.com/graphql
```
✅ Expected: GraphQL Playground HTML or introspection response

**If still timing out**:
- Check Render logs for errors
- Verify migration ran successfully
- Check database connection string in Render env vars

---

### **Step 4: Seed Test Data** ⏱️ 1 minute (Optional)

Populate database with Phase 3 test jobs:

**Option A: Via Render Dashboard**
1. Render → Service → Shell tab
2. Run: `npm run seed-multi`

**Option B: Via Local Connection**
```bash
cd backend
# Set DATABASE_URL environment variable to Railway database
DATABASE_URL="your_railway_db_url" npm run seed-multi
```

**Creates**:
- 20 jobs with mixed statuses (unscheduled/scheduled/in_progress/completed)
- 50% paid, 50% unpaid billing
- Multi-day jobs (some spanning 2-3 days)
- 3 drivers, 3 vehicles, 5 routes

---

### **Step 5: Test Phase 3 Features** ⏱️ 10-15 minutes

Open: https://frontend-seven-mu-49.vercel.app

#### **A. Frontend Load Test**
- [ ] Page loads without errors
- [ ] Check browser console (F12) - should have no red errors
- [ ] Jobs page displays

#### **B. Jobs Page Tabs** (7 tabs total)
- [ ] Unscheduled tab shows unscheduled jobs
- [ ] Scheduled tab shows scheduled jobs
- [ ] In Progress tab shows in_progress jobs
- [ ] Completed tab shows completed jobs
- [ ] Archived tab shows archived jobs
- [ ] Customer Lookup tab displays
- [ ] **Calendar tab displays** ⭐ NEW

#### **C. Calendar View Features** ⭐ PHASE 3
- [ ] Calendar loads with FullCalendar component
- [ ] Jobs appear as colored events
- [ ] Can toggle between Month/Week/Day views
- [ ] **Multi-day jobs span multiple days** ⭐
- [ ] **Job colors match status**:
  - Gray = Unscheduled
  - Blue = Scheduled
  - Orange = In Progress
  - Green = Completed
- [ ] **Billing border colors** ⭐:
  - Red border = Unpaid
  - Green border = Paid
- [ ] Can click on job events
- [ ] Calendar navigation works (prev/next month)
- [ ] Legend shows at bottom

#### **D. Billing Tracking** ⭐ PHASE 3
- [ ] Jobs show billing status badge
- [ ] Can toggle paid/unpaid
- [ ] Billing amount displays
- [ ] Invoice reference shows
- [ ] **Changes persist after page refresh** ⭐

#### **E. Customer Management** ⭐ PHASE 3
- [ ] Customer Lookup tab has search field
- [ ] Can search by name/email/phone
- [ ] Customer results display
- [ ] Can view customer job history
- [ ] **"Clone Job" button works** ⭐
- [ ] Cloned job has status=unscheduled
- [ ] Cloned job has billingStatus=unpaid

#### **F. Job Lifecycle** ⭐ PHASE 3
- [ ] Can change job status
- [ ] unscheduled → scheduled transition works
- [ ] scheduled → in_progress works
- [ ] in_progress → completed works
- [ ] Can archive completed jobs
- [ ] Archived jobs appear in Archived tab
- [ ] **Status colors update immediately** ⭐

---

### **Step 6: Backend API Tests** (Optional - Advanced)

Test GraphQL endpoints directly:

**Open GraphQL Playground**:
https://routing-dispatch-backend.onrender.com/graphql

**Test Queries**:

```graphql
# 1. Get jobs by status
query {
  jobs(status: "scheduled") {
    id
    customerName
    status
    startDate
    endDate
    billingStatus
  }
}

# 2. Get unpaid jobs
query {
  jobs(billingStatus: "unpaid") {
    id
    customerName
    billingAmount
    billingStatus
  }
}

# 3. Job history (date range)
query {
  jobHistory(
    start: "2026-01-01T00:00:00Z"
    end: "2026-01-31T23:59:59Z"
  ) {
    id
    customerName
    startDate
    endDate
  }
}

# 4. Search customers
query {
  searchCustomers(query: "Customer") {
    id
    name
    email
  }
}
```

**Test Mutations**:

```graphql
# 1. Clone a job (replace JOB_ID)
mutation {
  cloneJob(id: "JOB_ID") {
    id
    status  # Should be 'unscheduled'
    billingStatus  # Should be 'unpaid'
  }
}

# 2. Update billing
mutation {
  updateJobBilling(id: "JOB_ID", input: {
    billingStatus: paid
    billingAmount: 250.00
    invoiceRef: "INV-2026-001"
  }) {
    id
    billingStatus
    billingAmount
  }
}

# 3. Update lifecycle
mutation {
  updateJobLifecycle(id: "JOB_ID", input: {
    status: completed
  }) {
    id
    status
    completedAt
  }
}
```

---

## 🎯 Success Criteria

**Phase 3 Option B is LIVE when**:

1. ✅ Backend `/health` returns 200 OK
2. ✅ GraphQL playground accessible
3. ✅ Frontend loads without errors
4. ✅ Calendar tab displays with jobs
5. ✅ Multi-day jobs span correctly
6. ✅ Billing colors visible (borders)
7. ✅ Customer search works
8. ✅ Job cloning works
9. ✅ Lifecycle transitions work
10. ✅ Changes persist after refresh

---

## 🐛 Troubleshooting

### Backend Still Timing Out
**Cause**: Migration not run or failed
**Fix**:
1. Check Railway Postgres logs
2. Manually verify columns exist:
   ```sql
   \d jobs
   ```
3. Re-run migration if needed

### Frontend Shows "Network Error"
**Cause**: Backend not responding
**Fix**:
1. Check backend health: `curl https://routing-dispatch-backend.onrender.com/health`
2. Check Render logs for errors
3. Verify DATABASE_URL in Render env vars

### Calendar Shows No Events
**Cause**: Jobs don't have `start_date`
**Fix**:
1. Run seed script to populate test jobs
2. Only jobs with `start_date` appear on calendar
3. Unscheduled jobs won't show (expected)

### GraphQL Error: "Column does not exist"
**Cause**: Migration not applied
**Fix**: Run migration (Step 1)

---

## 📊 What Changed in Phase 3

**Backend**:
- 8 new columns on jobs table
- New customers table
- 9 new GraphQL endpoints
- Job cloning capability
- Billing tracking (no payment processing)
- Multi-day job support

**Frontend**:
- FullCalendar integration
- 7 tabs on Jobs page (was 5)
- Calendar view (month/week/day)
- Color-coded job statuses
- Billing status indicators

**Database**:
- Added: start_date, end_date, billing_status, billing_amount, billing_notes, invoice_ref, customer_id, archived_at
- New customers table

---

## 🔗 Important Links

**Frontend**: https://frontend-seven-mu-49.vercel.app
**Backend**: https://routing-dispatch-backend.onrender.com
**GraphQL**: https://routing-dispatch-backend.onrender.com/graphql
**GitHub**: https://github.com/loganmetsker-droid/Routing-

**Railway Project**: lucid-blessing (Postgres database)
**Render Service**: routing-dispatch-backend

---

## 📝 Next Steps

1. **Run database migration** (Step 1 above) ⏱️ 2-3 min
2. **Restart Render backend** (Step 2) ⏱️ 1 min
3. **Verify backend health** (Step 3) ⏱️ 1 min
4. **Test Phase 3 features** (Step 5) ⏱️ 10-15 min

**Total Time**: ~15-20 minutes

---

**All Phase 3 code is deployed. Only the database migration step remains to make everything live.**
