# KIB-ERP Complete Application Flow & Role Access

---

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     KIB-ERP Dashboard                        │
│  (DashboardLayout with Tour, WelcomeScreen, HeaderTourBtn)  │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴─────────┬──────────────┬──────────────┐
        │                  │              │              │
    ┌───▼──┐         ┌────▼────┐    ┌───▼──┐       ┌──▼────┐
    │Master│         │Production│   │Procure│      │Reports│
    │Data  │         │          │   │ment   │      │&Admin  │
    └──────┘         └──────────┘   └───────┘      └────────┘
        │                  │              │              │
   ┌────▼────┐      ┌──────▼──────┐     │         ┌────▼─────┐
   │- Materials   │- BOM         │     │         │- Analytics
   │- Suppliers   │- Production  │     │         │- User Mgmt
   │- Warehouses  │- Orders      │     │         │- Settings
   └─────────────┘ └──────────────┘     │         └──────────┘
                                        │
                                   ┌───▼──────┐
                                   │Inventory │
                                   │- Stock   │
                                   │- GRN     │
                                   │- Finished│
                                   │- Req.    │
                                   └──────────┘
```

---

## 📋 7 Core Modules

### 1. **Master Data** (Static Reference Data)
- Materials (Raw, Packaging, Finished)
- Suppliers (Vendor Info)
- Warehouses (Location/Storage)

### 2. **Production** (Recipe & Manufacturing)
- Bill of Materials (BOM) - Recipes
- Production Orders - Execution
- Traceability - Batch History

### 3. **Inventory** (Stock Management)
- Stock Ledger - Current Inventory
- Goods Receipt (GRN) - Receiving
- Finished Goods - Output Management
- Daily Production - Yield Tracking

### 4. **Procurement** (Vendor Orders)
- Requisitions - Internal Requests
- Purchase Orders - Vendor Orders
- Supplier Management

### 5. **Quality Assurance** (Testing & Approval)
- Material Inspections - GRN Testing
- Batch Management - Release/Hold
- Certificates & Traceability

### 6. **Reports & Alerts** (Analytics)
- KPI Dashboard
- Compliance Reports
- Approval Queue

### 7. **Admin** (System Management)
- User Management
- Settings
- System Configuration

---

## 👥 6 User Roles & Access Control

### Role Hierarchy
```
┌─────────────────────────────┐
│     SUPER_ADMIN             │ ← Full system control
│ (Can access everything)     │
└──────────────┬──────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼──┐  ┌───▼────┐  ┌──▼──────┐
│EXEC. │  │PROD.   │  │QA.      │
│ADMIN │  │MANAGER │  │INSPECTOR│
└───┬──┘  └───┬────┘  └──┬──────┘
    │         │          │
    └────┬────┴────┬─────┘
         │         │
    ┌────▼──┐  ┌──▼──────┐
    │STORE  │  │PROCURE  │
    │OFFICER│  │OFFICER  │
    └───────┘  └─────────┘
```

---

## 🔐 Detailed Role Access Matrix

### SUPER_ADMIN
**Title**: System Administrator  
**Access Level**: Complete  
**Primary Role**: System control & configuration

| Module | Permission | Actions |
|--------|-----------|---------|
| Master Data | ✅ Full | Create, Read, Update, Delete all materials/suppliers/warehouses |
| Production | ✅ Full | Create BOMs, Plan orders, View all production |
| Inventory | ✅ Full | Add stock, Transfer, Adjust, View all inventory |
| Procurement | ✅ Full | Create POs, Manage suppliers, Approve requisitions |
| QA | ✅ Full | Approve/reject all inspections |
| Reports | ✅ Full | View all reports & analytics |
| Admin | ✅ Full | Manage users, Change settings, System config |

**Daily Tasks**:
- System monitoring
- User management
- Configuration updates
- Exception approvals
- Audit reviews

**Modules They Can Access**: ALL 7  
**Modules They Cannot Access**: NONE

---

### EXECUTIVE_ADMIN
**Title**: Executive/Manager  
**Access Level**: Strategic Oversight  
**Primary Role**: Strategic decisions & approvals

| Module | Permission | Actions |
|--------|-----------|---------|
| Master Data | 🔍 Read-Only | View materials, suppliers, warehouses |
| Production | 🔍 Read-Only | View BOMs, Production orders, KPIs |
| Inventory | 🔍 Read-Only | View stock levels, Finished goods |
| Procurement | ✏️ Partial | Approve high-value POs (>threshold) |
| QA | ✏️ Partial | Review inspection results |
| Reports | ✅ Full | View all dashboards & analytics |
| Admin | ❌ No Access | Cannot manage users |

**Daily Tasks**:
- Monitor KPIs
- Approve exceptions
- Review reports
- Strategic planning
- Budget oversight

**Modules They Can Access**: Master Data (view), Production (view), Inventory (view), Procurement (partial), QA (partial), Reports (full)  
**Modules They Cannot Access**: Admin

---

### PRODUCTION_MANAGER
**Title**: Production Planning  
**Access Level**: Operational  
**Primary Role**: Recipe & production planning

| Module | Permission | Actions |
|--------|-----------|---------|
| Master Data | 🔍 Read-Only | View materials, suppliers |
| Production | ✅ Full | Create/Edit BOMs, Plan orders, Schedule, Track yield |
| Inventory | ✏️ Partial | View stock, Check availability |
| Procurement | 🔍 Read-Only | View POs (for ingredient status) |
| QA | 🔍 Read-Only | View inspection status |
| Reports | ✏️ Partial | View production reports only |
| Admin | ❌ No Access | Cannot access |

**Daily Tasks**:
- Create/update BOMs
- Plan production orders
- Check ingredient availability
- Monitor production yield
- Schedule on machines/shifts
- Track batch completion

**Modules They Can Access**: Master Data (view), Production (full), Inventory (partial), Procurement (view), QA (view), Reports (partial)  
**Modules They Cannot Access**: Admin

---

### STORE_OFFICER (Warehouse Manager)
**Title**: Warehouse Operations  
**Access Level**: Operational  
**Primary Role**: Stock & warehouse management

| Module | Permission | Actions |
|--------|-----------|---------|
| Master Data | 🔍 Read-Only | View warehouses, materials |
| Production | 🔍 Read-Only | View production schedule |
| Inventory | ✅ Full | Receive goods (GRN), Transfer stock, Adjust, Monitor expiry |
| Procurement | 🔍 Read-Only | View PO delivery status |
| QA | 🔍 Read-Only | View material inspection results |
| Reports | 🔍 Read-Only | View inventory reports only |
| Admin | ❌ No Access | Cannot access |

**Daily Tasks**:
- Receive goods (GRN process)
- Release ingredients to production
- Stock transfers
- Inventory adjustments
- Expiry management
- Stock counts
- Quality gate (hold/release quarantine)

**Modules They Can Access**: Master Data (view), Production (view), Inventory (full), Procurement (view), QA (view), Reports (view)  
**Modules They Cannot Access**: Admin

---

### PROCUREMENT_OFFICER
**Title**: Vendor Management  
**Access Level**: Operational  
**Primary Role**: Supplier & purchase orders

| Module | Permission | Actions |
|--------|-----------|---------|
| Master Data | ✏️ Partial | Manage suppliers, View materials |
| Production | 🔍 Read-Only | View ingredient requirements |
| Inventory | 🔍 Read-Only | View material status |
| Procurement | ✅ Full | Create POs, Manage suppliers, Requisition approval, Track delivery |
| QA | 🔍 Read-Only | View material inspection results |
| Reports | 🔍 Read-Only | View procurement reports only |
| Admin | ❌ No Access | Cannot access |

**Daily Tasks**:
- Manage supplier database
- Process purchase requisitions
- Create/issue purchase orders
- Track deliveries
- Manage PO amendments
- Follow up on delivery delays
- Supplier performance tracking

**Modules They Can Access**: Master Data (partial-suppliers), Production (view), Inventory (view), Procurement (full), QA (view), Reports (view)  
**Modules They Cannot Access**: Admin

---

### QA_INSPECTOR
**Title**: Quality Assurance  
**Access Level**: Operational  
**Primary Role**: Quality inspection & approval

| Module | Permission | Actions |
|--------|-----------|---------|
| Master Data | 🔍 Read-Only | View materials, standards |
| Production | 🔍 Read-Only | View production batches |
| Inventory | 🔍 Read-Only | View received goods (quarantine) |
| Procurement | 🔍 Read-Only | View PO materials |
| QA | ✅ Full | Inspect materials, Approve/reject batches, Issue certificates, Traceability |
| Reports | 🔍 Read-Only | View QA reports only |
| Admin | ❌ No Access | Cannot access |

**Daily Tasks**:
- Inspect received materials (GRN)
- Inspect finished goods batches
- Approve/reject based on tests
- Issue quality certificates
- Maintain traceability records
- Review test results
- Non-conformance reporting

**Modules They Can Access**: Master Data (view), Production (view), Inventory (view), Procurement (view), QA (full), Reports (view)  
**Modules They Cannot Access**: Admin

---

## 🔄 Complete Workflow Examples

### Example 1: New Material Purchase Flow

```
PRODUCTION_MANAGER creates BOM
    ↓
- Identifies missing ingredient
- Sends requisition request to procurement
    ↓
PROCUREMENT_OFFICER receives requisition
    ↓
- Checks supplier database
- Creates Purchase Order
- Sends to supplier
    ↓
Supplier Delivers Material
    ↓
STORE_OFFICER receives goods
    ↓
- Logs GRN (Goods Receipt Note)
- Material goes to quarantine
    ↓
QA_INSPECTOR inspects material
    ↓
- Tests quality
- Approves or rejects
    ↓
IF APPROVED:
  STORE_OFFICER
    ↓
  - Releases to production area
  - Updates inventory
    ↓
PRODUCTION_MANAGER
    ↓
  - Uses in production
    ↓
END
```

### Example 2: Production Order & Manufacturing

```
PRODUCTION_MANAGER
    ↓
1. Views BOM (Bill of Materials)
2. Plans Production Order
3. Schedules on production line
4. Enters expected yield
    ↓
STORE_OFFICER
    ↓
- Receives production schedule
- Releases required ingredients
    ↓
PRODUCTION_MANAGER
    ↓
- Monitors production status
- Tracks batch numbers
    ↓
At End of Production Day:
PRODUCTION_MANAGER
    ↓
- Logs actual yield
- System calculates % error
- Creates finished goods batch
    ↓
STORE_OFFICER
    ↓
- Receives finished goods
- Logs batch info
- Places in quarantine
    ↓
QA_INSPECTOR
    ↓
- Tests finished product
- Approves or rejects entire batch
    ↓
IF APPROVED:
  STORE_OFFICER
    ↓
  - Moves to finished goods storage
  - Auto-assigns 2-year expiry date
  - Updates inventory
    ↓
EXECUTIVE_ADMIN (views in reports)
    ↓
- Monitors production metrics
- Reviews yield efficiency
    ↓
END
```

### Example 3: Procurement Requisition

```
PRODUCTION_MANAGER
    ↓
- Identifies missing inventory
- Creates material requisition
    ↓
EXECUTIVE_ADMIN (auto notified)
    ↓
- Reviews for > $threshold
- Approves or rejects
    ↓
PROCUREMENT_OFFICER
    ↓
- Receives approved requisition
- Selects best supplier
- Creates Purchase Order
- Tracks delivery status
    ↓
STORE_OFFICER
    ↓
- Receives and logs GRN
    ↓
QA_INSPECTOR
    ↓
- Tests material quality
    ↓
STORE_OFFICER
    ↓
- Releases to production
    ↓
END
```

---

## 📊 Module-by-Module Access Summary

### MASTER DATA Module
```
Who Can Access:
  ✅ SUPER_ADMIN (Full CRUD)
  🔍 EXECUTIVE_ADMIN (View only)
  🔍 PRODUCTION_MANAGER (View only)
  🔍 STORE_OFFICER (View only - warehouses/materials)
  ✏️ PROCUREMENT_OFFICER (Create/Edit suppliers only)
  🔍 QA_INSPECTOR (View only)

Who CANNOT Access:
  ❌ None (Everyone has at least view access)
```

### PRODUCTION Module
```
Who Can Access:
  ✅ SUPER_ADMIN (Full CRUD)
  🔍 EXECUTIVE_ADMIN (View only - KPIs)
  ✅ PRODUCTION_MANAGER (Full - create BOMs, plan orders)
  🔍 STORE_OFFICER (View only - schedule)
  🔍 PROCUREMENT_OFFICER (View only - ingredient needs)
  🔍 QA_INSPECTOR (View only - batch tracking)

Who CANNOT Access:
  ❌ None (Everyone has at least view access)
```

### INVENTORY Module
```
Who Can Access:
  ✅ SUPER_ADMIN (Full CRUD)
  🔍 EXECUTIVE_ADMIN (View only - KPIs)
  ✏️ PRODUCTION_MANAGER (View only - check availability)
  ✅ STORE_OFFICER (Full - GRN, transfers, adjustments)
  🔍 PROCUREMENT_OFFICER (View only - delivery status)
  🔍 QA_INSPECTOR (View only - received material status)

Who CANNOT Access:
  ❌ None (Everyone has at least view access)
```

### PROCUREMENT Module
```
Who Can Access:
  ✅ SUPER_ADMIN (Full CRUD)
  ✏️ EXECUTIVE_ADMIN (Approve high-value POs)
  🔍 PRODUCTION_MANAGER (View only - PO status)
  🔍 STORE_OFFICER (View only - delivery status)
  ✅ PROCUREMENT_OFFICER (Full - create POs, manage suppliers)
  🔍 QA_INSPECTOR (View only - material spec)

Who CANNOT Access:
  ❌ None (Everyone has at least view access)
```

### QA Module
```
Who Can Access:
  ✅ SUPER_ADMIN (Full CRUD)
  ✏️ EXECUTIVE_ADMIN (View inspection results)
  🔍 PRODUCTION_MANAGER (View inspection status)
  🔍 STORE_OFFICER (View quarantine status)
  🔍 PROCUREMENT_OFFICER (View test results)
  ✅ QA_INSPECTOR (Full - inspect, approve/reject)

Who CANNOT Access:
  ❌ None (Everyone has at least view access)
```

### REPORTS Module
```
Who Can Access:
  ✅ SUPER_ADMIN (View all)
  ✅ EXECUTIVE_ADMIN (View all dashboards & KPIs)
  ✏️ PRODUCTION_MANAGER (View production reports only)
  🔍 STORE_OFFICER (View inventory reports only)
  🔍 PROCUREMENT_OFFICER (View procurement reports only)
  🔍 QA_INSPECTOR (View QA reports only)

Who CANNOT Access:
  ❌ None (Everyone has view access to their relevant reports)
```

### ADMIN Module
```
Who Can Access:
  ✅ SUPER_ADMIN (Full - manage users, settings, config)

Who CANNOT Access:
  ❌ EXECUTIVE_ADMIN
  ❌ PRODUCTION_MANAGER
  ❌ STORE_OFFICER
  ❌ PROCUREMENT_OFFICER
  ❌ QA_INSPECTOR
```

---

## 🚀 Application Flow for New User

### First-Time User Login
```
User Logs In
    ↓
System checks: hasSeenTour = false?
    ↓
YES:
  - WelcomeScreen appears
  - Role-specific greeting shown
  - "Take Tour" button available
    ↓
  User clicks "Take Tour"
    ↓
  Interactive tour starts (50+ steps)
  - Tour tailored to user's role
  - Highlights key modules & features
  - Step-by-step walkthrough
    ↓
  User completes tour
    ↓
  System marks: hasSeenTour = true
    ↓
NO:
  - Dashboard loads directly
  - Help button (?) available in header
```

### Returning User Login
```
User Logs In
    ↓
System checks: hasSeenTour = true?
    ↓
YES:
  - Dashboard loads directly
  - Welcome screen NOT shown
  - Help button available if needed
    ↓
NO:
  - WelcomeScreen shows again
  - Offer tour option
```

### Help Menu Access
```
User clicks "?" button in header
    ↓
Menu appears with options:
  1. Take Tour (Restart role-specific tour)
  2. User Guide (Full SETUP_AND_USER_GUIDE.md)
  3. FAQ (Common questions)
    ↓
User selects option
    ↓
Content displays/navigates
```

---

## 📱 Dashboard Views by Role

### SUPER_ADMIN Dashboard
- System Status
- All KPIs
- User Activity
- System Health
- Recent Transactions
- All Modules Quick Links

### EXECUTIVE_ADMIN Dashboard
- Production KPIs
- Inventory Status
- Approval Queue
- Budget Overview
- Key Metrics
- Strategic Reports

### PRODUCTION_MANAGER Dashboard
- Scheduled Orders
- BOM Status
- Current Production
- Ingredient Status
- Yield Tracking
- Machine Status

### STORE_OFFICER Dashboard
- Inventory Status
- Low Stock Alerts
- Expiry Warnings
- Pending GRNs
- Stock Movements
- Warehouse Levels

### PROCUREMENT_OFFICER Dashboard
- Pending Requisitions
- Active POs
- Delivery Status
- Supplier Performance
- Budget Spend
- Outstanding Orders

### QA_INSPECTOR Dashboard
- Pending Inspections
- Inspection Queue
- Recent Results
- Batch Status
- Defects Logged
- Certificates Issued

---

## 🔒 Security Rules

**Authentication**: Supabase JWT tokens

**Authorization**:
- Role-based access control (RBAC)
- User role stored in token
- Backend validates on each API call
- Frontend hides unavailable options

**Data Visibility**:
- Users see only data relevant to their role
- Modules disabled/hidden for non-authorized users
- Audit trail maintained for all actions

**Audit Trail**:
- All actions logged with timestamp
- User ID recorded
- Changes tracked

---

## 📋 Default Permissions

| Action | SUPER_ADMIN | EXEC_ADMIN | PROD_MGR | STORE | PROCURE | QA |
|--------|-------------|-----------|----------|-------|---------|-----|
| View Data | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Approve | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Admin | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🎯 Key Points

1. **Role-Based Access**: Each role sees only relevant modules
2. **Workflow-Driven**: Tasks flow logically between roles
3. **Separation of Duties**: No single person controls end-to-end
4. **Audit Trail**: All actions tracked & logged
5. **Clear Permissions**: Each role has explicit access level
6. **Scalable**: Easy to add new roles/permissions
7. **Secure**: Backend validates all requests

---

## 📌 Summary Table

| Role | # Modules | Full Access | Partial | View Only | Cannot Access |
|------|-----------|-----------|---------|-----------|---------------|
| SUPER_ADMIN | 7 | 7 | 0 | 0 | 0 |
| EXECUTIVE_ADMIN | 6 | 1 | 2 | 3 | 1 (Admin) |
| PRODUCTION_MANAGER | 6 | 1 | 1 | 4 | 1 (Admin) |
| STORE_OFFICER | 6 | 1 | 0 | 5 | 1 (Admin) |
| PROCUREMENT_OFFICER | 6 | 1 | 1 | 4 | 1 (Admin) |
| QA_INSPECTOR | 6 | 1 | 0 | 5 | 1 (Admin) |

---

**Complete Application Flow Documented**

