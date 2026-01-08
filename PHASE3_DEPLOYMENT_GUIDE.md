# Phase 3 Option B - Deployment & Verification Guide

## 🎯 Phase 3 Features Implemented

### Backend Features
✅ **Job Lifecycle Management**
- New states: `unscheduled`, `scheduled`, `in_progress`, `completed`, `archived`
- Legacy states maintained for backward compatibility
- Automatic `archivedAt` timestamp when jobs archived

✅ **Multi-Day Job Support**
- `start_date` and `end_date` fields
- Jobs can span multiple days on calendar
- Time window preserved for backward compatibility

✅ **Billing Tracking** (NO Payment Processing)
- `billing_status`: `paid` | `unpaid`
- `billing_amount`: Dollar amount (no processing)
- `billing_notes`: Internal notes
- `invoice_ref`: External invoice reference

✅ **Customer Entity for Job Reuse**
- Full CRUD operations
- Structured address support
- OneToMany relationship with jobs
- Search by name, email, phone, business name

✅ **New GraphQL Endpoints**
```graphql
# Queries
jobs(status, priority, billingStatus, startDate, endDate): [Job]
jobHistory(start, end): [Job]
customerJobHistory(customerId): [Job]
archivedJobs: [Job]
customers: [Customer]
searchCustomers(query): [Customer]

# Mutations
cloneJob(id): Job
updateJobBilling(id, input): Job
updateJobLifecycle(id, input): Job
createCustomer(input): Customer
updateCustomer(id, input): Customer
```

### Frontend Features
✅ **FullCalendar Integration**
- Month/Week/Day views
- Color-coded by job status
- Border colors for billing status (green=paid, red=unpaid)
- Click events for job details

## 📋 Deployment Status

### ✅ COMPLETED
1. **Code Implementation**: All Phase 3 features fully implemented
2. **Git**: All changes committed and pushed to GitHub
   - Latest commit: `9855ba0` - "feat: Add database migration for Phase 3 fields"
3. **Frontend Build**: Successfully deployed to Vercel
   - URL: https://frontend-seven-mu-49.vercel.app
4. **Backend Code**: Ready for deployment on Railway
   - Project: `lucid-blessing`
   - Service: `railway add`
   - Domain: https://railway-add-production-41ba.up.railway.app

### ⚠️ BLOCKED - Requires Manual Intervention
1. **Railway Backend Deployment**: Account on limited plan
2. **Database Migration**: New columns need to be created
3. **Frontend Environment Variables**: Point to localhost instead of live backend
4. **End-to-End Testing**: Cannot test without live backend

---

## 🚀 Deployment Steps (Manual)

### Step 1: Deploy Backend to Railway

**Option A: Upgrade Railway Plan (Recommended)**
1. Visit https://railway.com/account/plans
2. Upgrade to a plan that supports manual deployments
3. Run: `railway up` from the backend directory

**Option B: Configure GitHub Auto-Deploy**
1. Go to Railway project settings
2. Connect GitHub repository: `loganmetsker-droid/Routing-`
3. Set branch: `main`
4. Set root directory: `/backend`
5. Railway will auto-deploy on git push

**Option C: Wait for Auto-Deploy**
- Railway may auto-deploy from GitHub if already configured
- Check Railway dashboard for deployment status

### Step 2: Run Database Migration

**Important**: The production database needs new columns added.

**Using Railway CLI** (if you have database access):
```bash
cd backend
railway run psql $DATABASE_URL < migrations/add-job-workflow-fields.sql
```

**Using pgAdmin or Database GUI**:
1. Connect to Railway PostgreSQL database
2. Execute the migration script: `backend/migrations/add-job-workflow-fields.sql`

**Migration adds**:
- `start_date`, `end_date` columns to `jobs`
- `billing_status`, `billing_amount`, `billing_notes`, `invoice_ref` to `jobs`
- `customer_id`, `archived_at` to `jobs`
- `customers` table with full schema
- Indexes for performance

### Step 3: Update Vercel Environment Variables

Navigate to Vercel project settings or use CLI:

```bash
cd frontend

# Remove old variables
vercel env rm VITE_API_URL production
vercel env rm VITE_GRAPHQL_URL production
vercel env rm VITE_WS_URL production

# Add new variables pointing to Railway
echo "https://railway-add-production-41ba.up.railway.app" | vercel env add VITE_API_URL production
echo "https://railway-add-production-41ba.up.railway.app/graphql" | vercel env add VITE_GRAPHQL_URL production
echo "wss://railway-add-production-41ba.up.railway.app" | vercel env add VITE_WS_URL production

# Redeploy frontend to pick up new env vars
vercel --prod
```

**Or via Vercel Dashboard**:
1. Go to https://vercel.com/logandriods-projects/frontend/settings/environment-variables
2. Update these variables for **Production**:
   - `VITE_API_URL` → `https://railway-add-production-41ba.up.railway.app`
   - `VITE_GRAPHQL_URL` → `https://railway-add-production-41ba.up.railway.app/graphql`
   - `VITE_WS_URL` → `wss://railway-add-production-41ba.up.railway.app`
3. Trigger redeploy from Vercel dashboard

### Step 4: Seed Test Data

After backend is live and database migrated:

```bash
cd backend
railway run npm run seed-multi
```

This creates:
- 3 drivers
- 3 vehicles
- 20 jobs with:
  - Mixed lifecycle states (unscheduled/scheduled/in_progress/completed)
  - Billing status (50% paid, 50% unpaid)
  - Multi-day jobs (some spanning 2-3 days)
  - Past and future jobs for calendar testing
- 5 routes

---

## ✅ Verification Checklist

### Backend API Testing

**1. Health Check**
```bash
curl https://railway-add-production-41ba.up.railway.app/health
```
Expected: `{"status":"ok"}`

**2. GraphQL Endpoint**
```bash
curl -X POST https://railway-add-production-41ba.up.railway.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ jobs { id customerName status billingStatus } }"}'
```

**3. Test New Queries**
```graphql
# In GraphQL Playground: https://railway-add-production-41ba.up.railway.app/graphql

# Get jobs by lifecycle status
query {
  jobs(status: "scheduled") {
    id
    customerName
    status
    startDate
    endDate
  }
}

# Get unpaid jobs only
query {
  jobs(billingStatus: "unpaid") {
    id
    customerName
    billingAmount
    billingStatus
  }
}

# Get job history for date range
query {
  jobHistory(
    start: "2026-01-01T00:00:00Z"
    end: "2026-01-31T23:59:59Z"
  ) {
    id
    customerName
    startDate
    endDate
    status
  }
}

# Search customers
query {
  searchCustomers(query: "Customer 1") {
    id
    name
    email
    phone
  }
}

# Clone a job
mutation {
  cloneJob(id: "JOB_ID_HERE") {
    id
    customerName
    status  # Should be 'unscheduled'
    billingStatus  # Should be 'unpaid'
  }
}

# Update billing
mutation {
  updateJobBilling(
    id: "JOB_ID_HERE"
    input: {
      billingStatus: paid
      billingAmount: 250.00
      invoiceRef: "INV-2026-001"
    }
  ) {
    id
    billingStatus
    billingAmount
  }
}

# Update lifecycle
mutation {
  updateJobLifecycle(
    id: "JOB_ID_HERE"
    input: {
      status: completed
      startDate: "2026-01-08T09:00:00Z"
      endDate: "2026-01-08T17:00:00Z"
    }
  ) {
    id
    status
    startDate
    endDate
  }
}
```

### Frontend UI Testing

Open: https://frontend-seven-mu-49.vercel.app

**1. Jobs Page - Tab Navigation**
- [ ] Unscheduled tab shows jobs with `status: unscheduled`
- [ ] Scheduled tab shows jobs with `status: scheduled`
- [ ] In Progress tab shows jobs with `status: in_progress`
- [ ] Completed tab shows jobs with `status: completed`
- [ ] Archived tab shows jobs with `status: archived`
- [ ] Customer Lookup tab has search functionality
- [ ] Calendar tab displays FullCalendar component

**2. Calendar View**
- [ ] Month view displays all jobs for current month
- [ ] Week view shows jobs in weekly grid
- [ ] Day view shows jobs for single day
- [ ] View toggle buttons work (Month/Week/Day)
- [ ] Multi-day jobs span across multiple days
- [ ] Job colors match status:
  - Gray: Unscheduled
  - Blue: Scheduled
  - Orange: In Progress
  - Green: Completed
  - Dark Gray: Archived
- [ ] Border colors match billing:
  - Red border: Unpaid
  - Green border: Paid
- [ ] Clicking job opens detail dialog/drawer
- [ ] Legend shows status and billing color codes

**3. Billing Tracking**
- [ ] Jobs display billing status badge (Paid/Unpaid)
- [ ] Can toggle billing status
- [ ] Billing amount displays correctly
- [ ] Invoice reference shows when present
- [ ] Changes persist after page refresh

**4. Customer Lookup & Job Reuse**
- [ ] Search finds customers by name
- [ ] Search finds customers by email/phone
- [ ] Customer card shows past jobs
- [ ] "Reuse Job" button clones job
- [ ] Cloned job has status=unscheduled
- [ ] Cloned job has billingStatus=unpaid
- [ ] Original job data copied correctly

**5. Multi-Day Jobs**
- [ ] Jobs with start_date and end_date display correctly
- [ ] Spans multiple days on calendar
- [ ] Date range shows in job details
- [ ] Can create new multi-day jobs
- [ ] Can edit existing job dates

**6. Job Lifecycle Transitions**
- [ ] Can move job from unscheduled → scheduled
- [ ] Can move job from scheduled → in_progress
- [ ] Can move job from in_progress → completed
- [ ] Can archive completed jobs
- [ ] Archived jobs appear in Archived tab
- [ ] Status colors update immediately
- [ ] Changes persist after refresh

**7. Historical Data**
- [ ] Past jobs visible on calendar
- [ ] Can navigate to previous months
- [ ] Completed jobs remain in history
- [ ] Billing status shows for historical jobs

---

## 🐛 Known Issues & Troubleshooting

### Issue: Frontend shows "Network Error"
**Cause**: Frontend trying to connect to localhost instead of Railway
**Fix**: Update Vercel environment variables (see Step 3 above)

### Issue: GraphQL queries fail with "Column does not exist"
**Cause**: Database migration not run
**Fix**: Execute migration script (see Step 2 above)

### Issue: Railway backend not deploying
**Cause**: Plan limitations or GitHub auto-deploy not configured
**Fix**:
- Upgrade Railway plan, OR
- Configure GitHub auto-deploy in Railway settings, OR
- Contact Railway support

### Issue: Jobs don't appear on calendar
**Cause**: Jobs might not have `start_date` set
**Fix**: Only jobs with `start_date` appear on calendar. Unscheduled jobs won't show.

---

## 📊 Database Schema Changes

### New Columns on `jobs` Table
```sql
start_date            TIMESTAMP WITH TIME ZONE
end_date              TIMESTAMP WITH TIME ZONE
billing_status        VARCHAR(20) DEFAULT 'unpaid'
billing_amount        DECIMAL(10, 2)
billing_notes         TEXT
invoice_ref           VARCHAR(100)
customer_id           UUID
archived_at           TIMESTAMP WITH TIME ZONE
```

### New `customers` Table
```sql
CREATE TABLE customers (
  id                           UUID PRIMARY KEY,
  name                         VARCHAR(200) NOT NULL,
  phone                        VARCHAR(20),
  email                        VARCHAR(100),
  default_address              TEXT,
  default_address_structured   JSONB,
  business_name                TEXT,
  notes                        TEXT,
  exceptions                   TEXT,
  created_at                   TIMESTAMP WITH TIME ZONE,
  updated_at                   TIMESTAMP WITH TIME ZONE,
  deleted_at                   TIMESTAMP WITH TIME ZONE
);
```

---

## 🎉 Success Criteria

Phase 3 Option B deployment is successful when:

1. ✅ Backend health check returns 200 OK
2. ✅ All GraphQL queries execute without errors
3. ✅ Frontend loads without console errors
4. ✅ All 7 tabs visible on Jobs page
5. ✅ Calendar displays jobs with correct colors
6. ✅ Multi-day jobs span correctly
7. ✅ Billing toggle works and persists
8. ✅ Customer search and job reuse functional
9. ✅ Job lifecycle transitions work
10. ✅ Historical data accessible

---

## 📝 Files Modified in Phase 3

### Backend
- `src/modules/jobs/entities/job.entity.ts` - Extended with new fields
- `src/modules/jobs/jobs.service.ts` - New methods for lifecycle, billing, cloning
- `src/modules/jobs/jobs.resolver.ts` - New GraphQL queries/mutations
- `src/modules/jobs/dto/update-billing.dto.ts` - New DTO
- `src/modules/jobs/dto/update-lifecycle.dto.ts` - New DTO
- `src/modules/customers/*` - New module (entity, service, resolver, DTOs)
- `src/app.module.ts` - Registered CustomersModule
- `src/modules/dispatch/dispatch.service.ts` - Fixed location coordinates
- `seed-multi.ts` - Updated with lifecycle states and billing
- `migrations/add-job-workflow-fields.sql` - New migration

### Frontend
- `src/components/calendar/CalendarView.tsx` - New FullCalendar component
- `package.json` - Added FullCalendar dependencies

---

## 🔗 Important URLs

- **Frontend (Production)**: https://frontend-seven-mu-49.vercel.app
- **Backend (Railway)**: https://railway-add-production-41ba.up.railway.app
- **GraphQL Playground**: https://railway-add-production-41ba.up.railway.app/graphql
- **GitHub Repository**: https://github.com/loganmetsker-droid/Routing-
- **Railway Project**: lucid-blessing (production environment)

---

## 📞 Support

If you encounter issues:
1. Check Railway logs: `railway logs`
2. Check Vercel deployment logs in dashboard
3. Verify database migration ran successfully
4. Confirm environment variables are correct
5. Test backend endpoints directly with curl/Postman

---

**Generated**: 2026-01-08
**Phase**: 3 Option B - Job Workflow Enhancements
**Status**: Code Complete, Awaiting Deployment
