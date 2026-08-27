# KIB-ERP Role-to-Task Mapping & Workflow Guide

## Overview
This document maps each user role to their specific responsibilities, accessible modules, and key workflows in the KIB-ERP system.

---

## Role Hierarchy & Permissions Matrix

### 1. SUPER_ADMIN
**Access Level:** Full system access | **Module Access:** All 7 modules

| Module | Create | Read | Update | Delete | Approve |
|--------|--------|------|--------|--------|---------|
| Master Data | ✅ | ✅ | ✅ | ✅ | ✅ |
| Procurement | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inventory | ✅ | ✅ | ✅ | ✅ | ✅ |
| Production | ✅ | ✅ | ✅ | ✅ | ✅ |
| QA | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reports | ❌ | ✅ | ❌ | ❌ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |

**Primary Responsibilities:**
- System configuration and maintenance
- User management and role assignment
- All approval workflows
- Data management across all modules
- System troubleshooting

**Key Workflows:**
1. Create and manage user accounts
2. Configure master data (materials, suppliers, warehouses)
3. Approve critical operations (stock adjustments, production orders)
4. Override any system restrictions
5. Generate custom reports

**Dashboard View:** Full dashboard with all KPIs and module shortcuts

---

### 2. EXECUTIVE_ADMIN
**Access Level:** Read-mostly with strategic approvals | **Module Access:** All modules (limited CRUD)

| Module | Create | Read | Update | Delete | Approve |
|--------|--------|------|--------|--------|---------|
| Master Data | ❌ | ✅ | ❌ | ❌ | ❌ |
| Procurement | ❌ | ✅ | ❌ | ❌ | ❌ |
| Inventory | ❌ | ✅ | ❌ | ❌ | ✅ |
| Production | ❌ | ✅ | ❌ | ❌ | ❌ |
| QA | ❌ | ✅ | ❌ | ❌ | ❌ |
| Reports | ✅ | ✅ | ❌ | ❌ | ❌ |
| Admin | ❌ | ✅ | ❌ | ❌ | ❌ |

**Primary Responsibilities:**
- High-level oversight and monitoring
- Approves high-value inventory adjustments
- Report generation and analysis
- Strategic decision-making based on KPIs

**Key Workflows:**
1. Monitor inventory levels and stockouts
2. Approve inventory adjustment requests above threshold
3. Generate and review daily/weekly/monthly reports
4. Review procurement status
5. Track production efficiency

**Dashboard View:** Executive dashboard with KPIs, trends, alerts, report library

---

### 3. PRODUCTION_MANAGER
**Access Level:** Full production control | **Module Access:** Production (full), Inventory (read), Reports (read), Master Data (read), Procurement (read)

| Module | Create | Read | Update | Delete | Approve |
|--------|--------|------|--------|--------|---------|
| Master Data | ❌ | ✅ | ❌ | ❌ | ❌ |
| Procurement | ❌ | ✅ | ❌ | ❌ | ❌ |
| Inventory | ❌ | ✅ | ❌ | ❌ | ❌ |
| Production | ✅ | ✅ | ✅ | ❌ | ✅ |
| QA | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reports | ❌ | ✅ | ❌ | ❌ | ❌ |
| Admin | ❌ | ❌ | ❌ | ❌ | ❌ |

**Primary Responsibilities:**
- Define production recipes (BOMs - Bill of Materials)
- Create and schedule production orders
- Track production progress and yield
- Manage production-related approvals
- Monitor ingredient availability

**Key Workflows:**
1. **Recipe Management (BOM)**
   - Create new BOMs with ingredient formulas
   - Define yield targets (% or absolute quantities)
   - Set version control (DRAFT → APPROVED → ACTIVE)
   - Archive old versions

2. **Production Planning**
   - View available inventory and materials
   - Create production orders linked to BOMs
   - Schedule production batches
   - Set target quantities and dates

3. **Production Monitoring**
   - Track batch progress through stages
   - Record actual yield vs. expected yield
   - Log production issues/deviations
   - Approve production completion

4. **Inventory Checks**
   - View real-time stock levels
   - Confirm ingredient availability before scheduling
   - Monitor expiry dates
   - Alert system on low stock

**Dashboard View:** Production-focused dashboard with BOM library, active orders, yield metrics, upcoming schedules

**Tour Focus Areas:**
- BOM creation and versioning
- Production order scheduling
- Yield tracking and variance analysis
- Batch status monitoring

---

### 4. STORE_OFFICER
**Access Level:** Inventory operations | **Module Access:** Procurement (limited), Inventory (full), Master Data (read)

| Module | Create | Read | Update | Delete | Approve |
|--------|--------|------|--------|--------|---------|
| Master Data | ❌ | ✅ | ❌ | ❌ | ❌ |
| Procurement | ✅ | ✅ | ✅ | ❌ | ❌ |
| Inventory | ✅ | ✅ | ✅ | ❌ | ❌ |
| Production | ❌ | ✅ | ❌ | ❌ | ❌ |
| QA | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reports | ❌ | ❌ | ❌ | ❌ | ❌ |
| Admin | ❌ | ❌ | ❌ | ❌ | ❌ |

**Primary Responsibilities:**
- Manage physical inventory in warehouses
- Receive goods (GRN - Goods Receipt Note)
- Process requisitions
- Record stock movements and transfers
- Conduct stock counts and adjustments

**Key Workflows:**
1. **Goods Receipt (GRN)**
   - Receive purchase orders from suppliers
   - Inspect and verify quantities
   - Create GRN records
   - Update stock levels
   - Record into appropriate bins/zones

2. **Requisitions**
   - Create material requisitions
   - Submit for approval
   - Track requisition status
   - Receive approval feedback

3. **Stock Movements**
   - Transfer stock between bins/zones
   - Issue materials to production
   - Record stock adjustments
   - Track damaged/expired stock

4. **Inventory Management**
   - Monitor stock levels by location
   - Check expiry dates and shelf life
   - Perform physical stock counts
   - Identify obsolete or slow-moving items

**Dashboard View:** Warehouse/inventory dashboard with stock levels by location, recent movements, pending requisitions, stock alerts

**Tour Focus Areas:**
- Warehouse and bin navigation
- GRN creation and processing
- Stock transfer procedures
- Inventory lookup and tracking

---

### 5. PROCUREMENT_OFFICER
**Access Level:** Procurement operations & supplier management | **Module Access:** Procurement (full), Master Data (limited create/update), Inventory (read)

| Module | Create | Read | Update | Delete | Approve |
|--------|--------|------|--------|--------|---------|
| Master Data | ✅ | ✅ | ✅ | ❌ | ❌ |
| Procurement | ✅ | ✅ | ✅ | ❌ | ✅ |
| Inventory | ❌ | ✅ | ❌ | ❌ | ❌ |
| Production | ❌ | ❌ | ❌ | ❌ | ❌ |
| QA | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reports | ❌ | ❌ | ❌ | ❌ | ❌ |
| Admin | ❌ | ❌ | ❌ | ❌ | ❌ |

**Primary Responsibilities:**
- Manage supplier directory
- Process purchase orders
- Approve requisitions
- Track PO status and delivery
- Manage supplier communications

**Key Workflows:**
1. **Supplier Management**
   - Add and update suppliers
   - Manage supplier contacts
   - Track supplier performance
   - Maintain supplier documents (certificates, NAFDAC)

2. **Requisition Processing**
   - Review submitted requisitions
   - Approve/reject material requisitions
   - Convert approved requisitions to POs
   - Assign suppliers

3. **Purchase Order Management**
   - Create POs from requisitions
   - Set delivery dates and quantities
   - Track expected delivery dates
   - Monitor PO status

4. **GRN Coordination**
   - Track received vs. ordered quantities
   - Identify delivery discrepancies
   - Coordinate with Store Officer on GRN

**Dashboard View:** Procurement dashboard with supplier list, pending requisitions, active POs, delivery tracking, supplier performance metrics

**Tour Focus Areas:**
- Supplier creation and management
- Requisition approval workflow
- PO creation and tracking
- Delivery monitoring

---

### 6. QA_INSPECTOR
**Access Level:** Quality assurance & batch management | **Module Access:** QA (full), Inventory (limited update), Master Data (read), Procurement (read), Production (read)

| Module | Create | Read | Update | Delete | Approve |
|--------|--------|------|--------|--------|---------|
| Master Data | ❌ | ✅ | ❌ | ❌ | ❌ |
| Procurement | ❌ | ✅ | ❌ | ❌ | ❌ |
| Inventory | ❌ | ✅ | ✅ | ❌ | ❌ |
| Production | ❌ | ✅ | ❌ | ❌ | ❌ |
| QA | ✅ | ✅ | ✅ | ❌ | ✅ |
| Reports | ❌ | ❌ | ❌ | ❌ | ❌ |
| Admin | ❌ | ❌ | ❌ | ❌ | ❌ |

**Primary Responsibilities:**
- Inspect incoming materials
- Conduct quality tests
- Approve/reject batches
- Block defective batches
- Track quality metrics

**Key Workflows:**
1. **GRN Inspection**
   - Review incoming GRNs
   - Conduct material inspection
   - Record test results
   - Approve or flag materials

2. **Batch Release/Block**
   - Review production batches
   - Block defective batches
   - Release approved batches to market
   - Create rejection notes

3. **Quality Testing**
   - Create test records
   - Log test parameters and results
   - Generate test certificates
   - Track test history

4. **Traceability**
   - Track materials through production
   - Link finished goods to ingredient batches
   - Generate traceability reports
   - Support recalls if needed

**Dashboard View:** QA dashboard with pending inspections, batch status, test queue, quality metrics, blocked batches

**Tour Focus Areas:**
- Material inspection process
- Quality test creation and logging
- Batch approval/blocking
- Traceability tracking

---

## Cross-Role Workflows

### Procurement Flow
```
Store Officer (Create Requisition)
    ↓
Procurement Officer (Approve Requisition)
    ↓
Procurement Officer (Create Purchase Order)
    ↓
Store Officer (Receive GRN)
    ↓
QA Inspector (Inspect Materials)
    ↓
QA Inspector (Approve/Block Batch)
```

### Production Flow
```
Production Manager (Create BOM)
    ↓
Production Manager (Approve BOM Version)
    ↓
Production Manager (Create Production Order)
    ↓
Store Officer (Issue Materials from Stock)
    ↓
Production Manager (Record Actual Yield)
    ↓
QA Inspector (Approve Final Batch)
```

### Inventory Management Flow
```
Store Officer (Record Stock Movement)
    ↓
Executive Admin (Approve if high-value adjustment)
    ↓
System (Updates Stock Ledger)
    ↓
All Users (View Updated Inventory)
```

---

## Module-by-Module Breakdown

### Master Data Module
**Purpose:** Central configuration of all static/reference data

**Access by Role:**
- SUPER_ADMIN: Full CRUD
- EXECUTIVE_ADMIN: Read-only
- PRODUCTION_MANAGER: Read-only
- STORE_OFFICER: Read-only
- PROCUREMENT_OFFICER: Create suppliers, Update suppliers, Read all
- QA_INSPECTOR: Read-only

**Key Functions:**
1. **Materials** - Define raw materials, packaging, finished products with:
   - SKU and barcode
   - Unit of measure
   - Shelf life / expiry requirements
   - Lot/batch tracking requirements
   - NAFDAC/MSDS document links

2. **Suppliers** - Track supplier information:
   - Contact details
   - Payment terms
   - Performance ratings
   - Associated materials

3. **Warehouses** - Define storage locations:
   - Warehouse zones (e.g., A-Block, B-Block)
   - Storage bins/racks
   - Zone capacities
   - Temperature/humidity controls (if applicable)

---

### Production Module
**Purpose:** Manage recipes, production orders, and batch tracking

**Access by Role:**
- SUPER_ADMIN: Full CRUD + Approve
- PRODUCTION_MANAGER: Full CRUD + Approve
- Others: Read-only (with limited visibility)

**Key Functions:**
1. **BOM (Bill of Materials)** - Recipe definitions:
   - Product name and description
   - Version control (DRAFT → APPROVED → ACTIVE)
   - Expected yield and units
   - Ingredient list with quantities (% or absolute)
   - Cost calculation

2. **Production Orders** - Scheduling and tracking:
   - Link to approved BOM
   - Target quantity
   - Scheduled start/end dates
   - Status tracking (SCHEDULED → PROCESSING → COMPLETED → WASTED)
   - Batch reference

3. **Traceability** - Material tracking:
   - Finished goods linked to ingredient batches
   - Production batch history
   - Full audit trail

---

### Inventory Module
**Purpose:** Stock management and warehouse operations

**Access by Role:**
- SUPER_ADMIN: Full CRUD + Approve
- EXECUTIVE_ADMIN: Read + Approve (high-value)
- STORE_OFFICER: Full CRUD (no delete)
- PROCUREMENT_OFFICER: Read-only
- QA_INSPECTOR: Read + Update (blocking/releasing)
- PRODUCTION_MANAGER: Read-only

**Key Functions:**
1. **Stock Ledger** - Real-time inventory:
   - Material quantities by location/bin
   - Batch/lot tracking
   - Expiry date monitoring
   - Stock status (available/reserved/blocked)

2. **GRN (Goods Receipt Note)** - Receiving:
   - Link to purchase orders
   - Quantity verification
   - Bin assignment
   - Lot/batch creation

3. **Stock Movements** - Transfers and issues:
   - Bin-to-bin transfers
   - Material issue to production
   - Stock adjustments
   - Write-offs (damaged/expired)

4. **Stock Counts** - Physical verification:
   - Cycle counts
   - Variance investigation
   - Adjustment posting

---

### Procurement Module
**Purpose:** Purchase order and supplier management

**Access by Role:**
- SUPER_ADMIN: Full CRUD + Approve
- STORE_OFFICER: Create requisitions, Submit, Track
- PROCUREMENT_OFFICER: Full CRUD + Approve
- Others: Read-only

**Key Functions:**
1. **Requisitions** - Material requests:
   - Create by Store Officer or Production Manager
   - Approve by Procurement Officer
   - Link to POs

2. **Purchase Orders** - Supplier orders:
   - Create from requisitions
   - Assign supplier and delivery date
   - Track received quantity
   - Record on-time delivery rate

3. **Supplier Management** - Vendor info:
   - Contact and payment terms
   - Performance tracking
   - Certification status

---

### QA Module
**Purpose:** Quality assurance and batch certification

**Access by Role:**
- SUPER_ADMIN: Full CRUD + Approve
- QA_INSPECTOR: Full CRUD + Approve
- Others: Read-only (for traceability)

**Key Functions:**
1. **Inspections** - Material testing:
   - Create inspection records
   - Log test parameters and results
   - Approve or reject

2. **Batch Management** - Release/Block:
   - Release approved batches
   - Block defective batches
   - Track rejection reasons

3. **Certificates & Reports** - Documentation:
   - Generate test certificates
   - Quality audit trails
   - Traceability reports

---

### Reports Module
**Purpose:** Business intelligence and analytics

**Access by Role:**
- SUPER_ADMIN: Read-only (view all)
- EXECUTIVE_ADMIN: Create + Read (custom reports)
- Others: Read standard reports

**Key Reports:**
1. **Procurement Reports** - PO status, supplier performance, delivery trends
2. **Production Reports** - Yield analysis, BOM usage, batch performance
3. **Inventory Reports** - Stock levels, turnover, expiry alerts, write-offs
4. **Quality Reports** - Defect rates, inspection results, batch rejections
5. **Financial Reports** - Inventory valuation, cost analysis

---

### Admin Module
**Purpose:** System configuration and user management

**Access by Role:**
- SUPER_ADMIN: Full CRUD + Approve
- EXECUTIVE_ADMIN: Read-only
- Others: No access

**Key Functions:**
1. **User Management** - Account administration:
   - Create/edit/deactivate users
   - Assign roles
   - Reset passwords

2. **System Configuration:**
   - Company settings
   - Default values
   - System parameters

3. **Audit Logs:**
   - Track all user actions
   - Review changes
   - Compliance reporting

---

## First-Time User Onboarding by Role

### For SUPER_ADMIN
1. **Welcome & System Overview** (1 min)
   - Explain full system access
   - Show dashboard

2. **Core Modules Tour** (3 min)
   - Walk through each module
   - Show user management

3. **Example Workflow** (2 min)
   - Create sample supplier
   - Create sample material
   - Show how roles limit access

### For PRODUCTION_MANAGER
1. **Welcome & Your Role** (1 min)
   - Explain production responsibilities

2. **BOM Management** (3 min)
   - Walk through BOM creation
   - Show versioning workflow
   - Ingredient entry

3. **Production Orders** (2 min)
   - Create production order
   - Link to BOM
   - Set schedule

4. **Inventory Check** (1 min)
   - View available materials
   - Check expiry dates

### For STORE_OFFICER
1. **Welcome & Your Role** (1 min)
2. **Warehouse Navigation** (2 min)
   - Understand zones/bins
3. **GRN Process** (3 min)
   - Receive goods
   - Assign bins
4. **Stock Movements** (2 min)
   - Transfer between bins
   - Issue to production
5. **Requisitions** (1 min)
   - Create material request

### For PROCUREMENT_OFFICER
1. **Welcome & Your Role** (1 min)
2. **Supplier Management** (2 min)
   - Add supplier
   - Update supplier info
3. **Requisition Workflow** (2 min)
   - Review requisitions
   - Approve/reject
4. **Purchase Orders** (3 min)
   - Create PO from requisition
   - Track delivery
5. **Performance Tracking** (1 min)
   - View supplier metrics

### For QA_INSPECTOR
1. **Welcome & Your Role** (1 min)
2. **Material Inspection** (3 min)
   - Review incoming materials
   - Log test results
   - Approve/reject
3. **Batch Management** (2 min)
   - Release batches
   - Block defective batches
4. **Traceability** (2 min)
   - Track materials through production
   - Generate traceability reports

### For EXECUTIVE_ADMIN
1. **Welcome & Your Role** (1 min)
2. **Dashboard Overview** (2 min)
   - Key metrics and KPIs
   - Alert system
3. **Approval Workflow** (2 min)
   - Approve inventory adjustments
   - How to monitor approvals
4. **Reports** (2 min)
   - Available reports
   - How to generate custom reports
5. **System Monitoring** (1 min)
   - View system health

---

## Quick Reference: Who Does What?

| Task | Role(s) |
|------|---------|
| Create user accounts | SUPER_ADMIN |
| Add new suppliers | PROCUREMENT_OFFICER, SUPER_ADMIN |
| Add new materials | SUPER_ADMIN, PROCUREMENT_OFFICER (suppliers only) |
| Create BOM/Recipe | PRODUCTION_MANAGER, SUPER_ADMIN |
| Approve BOM version | PRODUCTION_MANAGER, SUPER_ADMIN |
| Create production order | PRODUCTION_MANAGER, SUPER_ADMIN |
| Receive goods (GRN) | STORE_OFFICER, SUPER_ADMIN |
| Inspect materials | QA_INSPECTOR, SUPER_ADMIN |
| Approve material batch | QA_INSPECTOR, SUPER_ADMIN |
| Create requisition | STORE_OFFICER, PRODUCTION_MANAGER, SUPER_ADMIN |
| Approve requisition | PROCUREMENT_OFFICER, SUPER_ADMIN |
| Create purchase order | PROCUREMENT_OFFICER, SUPER_ADMIN |
| Transfer stock | STORE_OFFICER, SUPER_ADMIN |
| Issue material to production | STORE_OFFICER, SUPER_ADMIN |
| Approve stock adjustment | EXECUTIVE_ADMIN, SUPER_ADMIN |
| Generate reports | EXECUTIVE_ADMIN, SUPER_ADMIN |
| View system audit logs | SUPER_ADMIN |
| Block/Release batches | QA_INSPECTOR, SUPER_ADMIN |

---

## Daily User Checklists by Role

### PRODUCTION_MANAGER Daily Checklist
- [ ] Review active production orders
- [ ] Check material availability for scheduled batches
- [ ] Monitor yield vs. target performance
- [ ] Approve completed production batches
- [ ] Check for low stock alerts on key materials

### STORE_OFFICER Daily Checklist
- [ ] Process overnight GRNs
- [ ] Verify bin assignments
- [ ] Check expiry dates on stock
- [ ] Process any requisitions
- [ ] Record stock movements
- [ ] Identify items for stock count

### PROCUREMENT_OFFICER Daily Checklist
- [ ] Review pending requisitions
- [ ] Check delivery status of POs
- [ ] Monitor expected deliveries
- [ ] Follow up on delayed orders
- [ ] Review supplier performance

### QA_INSPECTOR Daily Checklist
- [ ] Review pending material inspections
- [ ] Complete test recordings
- [ ] Approve/reject batches
- [ ] Check blocked batch status
- [ ] Generate test certificates

### EXECUTIVE_ADMIN Daily Checklist
- [ ] Review KPI dashboard
- [ ] Check critical alerts
- [ ] Review pending approvals
- [ ] Monitor system health
- [ ] Prepare end-of-day report

