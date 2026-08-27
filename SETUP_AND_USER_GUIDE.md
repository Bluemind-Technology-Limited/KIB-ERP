# KIB-ERP Complete Setup & User Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [Role-Based Access Guide](#role-based-access-guide)
4. [Module Walkthroughs](#module-walkthroughs)
5. [Common Workflows](#common-workflows)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

---

## System Overview

### What is KIB-ERP?
KIB-ERP is an integrated Enterprise Resource Planning system designed for manufacturing and supply chain management. It manages the complete lifecycle from procurement to production to quality assurance.

### Core Principles
- **Separation of Duties**: Each role has specific permissions to maintain control and accountability
- **Traceability**: Every action is logged with timestamps and user attribution
- **Real-time Visibility**: All stakeholders see current status across modules
- **Approval Workflows**: Critical operations require appropriate level of authorization
- **Quality First**: Multiple checkpoints ensure product quality

### System Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    KIB-ERP Dashboard                    │
├─────────────────────────────────────────────────────────┤
│ Master Data │ Procurement │ Inventory │ Production │ QA │
│ Reports     │ Admin       │                              │
├─────────────────────────────────────────────────────────┤
│              Backend API (Node.js/Express)              │
├─────────────────────────────────────────────────────────┤
│              Database (PostgreSQL/Prisma)               │
└─────────────────────────────────────────────────────────┘
```

---

## Getting Started

### First Login
1. Open KIB-ERP in your browser
2. Log in with your credentials
3. You'll see your role-specific dashboard
4. **First-time users**: A welcome tour will start automatically
   - Click "Next" to proceed through the tutorial
   - Click "Skip" to dismiss and explore on your own
   - Click "Help" at any time to restart the tour

### Dashboard Overview
Your dashboard shows:
- **Welcome Message**: Your name and role
- **Quick Stats**: Key metrics for your area
- **Recent Activity**: Latest actions in your modules
- **Action Buttons**: Quick access to common tasks
- **Alerts**: Critical items needing attention

### Navigation
- **Left Sidebar**: Module menu (visible based on your role)
- **Top Header**: Search, notifications, profile, help
- **Breadcrumbs**: Show current location in the system
- **Back/Forward**: Navigate between screens

### Taking the Tour Anytime
1. Click the **Help** icon (?) in the top-right header
2. Select "Take Tour" to restart the role-specific onboarding
3. Follow the highlighted steps
4. Read tooltips for detailed explanations
5. Use "Back" and "Next" to navigate
6. Click "Skip" or "Done" to exit

---

## Role-Based Access Guide

### Access Level Comparison Table

| Feature | Super Admin | Executive | Production Mgr | Store Officer | Procurement | QA |
|---------|:-----------:|:---------:|:--------------:|:-------------:|:-----------:|:--:|
| Create Users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View All Modules | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Create Materials | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Suppliers | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Create BOM | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Approve BOM | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Create Requisition | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Approve Requisition | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Create PO | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Create GRN | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Approve/Reject Batch | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Approve High-Value Adjustments | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Generate Reports | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| View Audit Logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Legend**: ✅ Full access | ⚠️ Limited access | ❌ No access

### Your Role-Specific Dashboard

#### SUPER_ADMIN Dashboard
- System health status
- User activity monitor
- Module shortcuts (all 7 modules)
- Critical alerts from all areas
- User management quick access
- System configuration shortcuts

#### EXECUTIVE_ADMIN Dashboard
- KPI dashboard (production, inventory, procurement, quality)
- Trend charts (yield %, on-time delivery, inventory turnover)
- Critical alerts requiring approval
- Custom report library
- Supplier performance dashboard
- Pending approval queue

#### PRODUCTION_MANAGER Dashboard
- Active production orders
- BOM library with versions
- Production schedule (next 7 days)
- Recent batches and yield metrics
- Material availability alerts
- Production vs. target performance

#### STORE_OFFICER Dashboard
- Warehouse layout view
- Current stock levels by location
- Expiry alerts (items expiring < 30 days)
- Recent GRN receipts
- Pending requisitions
- Stock movement history

#### PROCUREMENT_OFFICER Dashboard
- Supplier list with ratings
- Pending requisitions (awaiting approval)
- Active purchase orders with delivery tracking
- On-time delivery metrics by supplier
- Upcoming expected deliveries
- PO creation shortcuts

#### QA_INSPECTOR Dashboard
- Pending material inspections
- Test queue (materials waiting for inspection)
- Quality metrics (defect rate, approval %)
- Recently blocked batches
- Batch release/block quick actions
- Traceability search

---

## Module Walkthroughs

### Master Data Module

#### Purpose
Central repository for all static/reference data. Configure once, use everywhere.

#### Access by Role
| Action | Super Admin | Exec Admin | Prod Mgr | Store Officer | Procurement | QA |
|--------|:-----------:|:----------:|:--------:|:-------------:|:-----------:|:--:|
| Create Materials | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Update Materials | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete Materials | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View Materials | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Suppliers | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Update Suppliers | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Create Warehouses | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

#### 1. Materials
**What**: Raw materials, packaging, and finished products

**How to Add a Material**:
1. Go to Master Data → Materials
2. Click "Add Material" button
3. Fill in required fields:
   - **Name**: Product name (e.g., "Cocoa Butter")
   - **SKU**: Auto-generated or manual
   - **Type**: Raw / Packaging / Finished
   - **Unit of Measure**: kg, liters, units, etc.
   - **Category**: Optional grouping (e.g., Oils, Chemicals)
4. Optional fields:
   - **Barcode**: For scanning
   - **Shelf Life**: Days until expiration
   - **Requires Lot Tracking**: Yes/No
   - **NAFDAC Certificate**: Link to regulatory document
   - **MSDS**: Material Safety Data Sheet
5. Click "Create Material"
6. Material now available for use in BOMs and requisitions

**Best Practices**:
- Use consistent naming conventions (e.g., "Cocoa Butter - 100% Pure")
- Set accurate shelf life based on supplier data
- Always link NAFDAC for regulated materials
- Update MSDS links when new versions available
- Mark shelf-life materials as "Requires Lot Tracking"

#### 2. Suppliers
**What**: Vendor information and performance tracking

**How to Add a Supplier**:
1. Go to Master Data → Suppliers
2. Click "Add Supplier" button
3. Fill in:
   - **Name**: Supplier company name
   - **Contact Person**: Primary contact
   - **Email**: Contact email
   - **Phone**: Contact phone
   - **Address**: Supplier location
   - **Payment Terms**: Net 30, COD, etc.
   - **Rating**: Initial rating (1-5 stars)
4. Link materials this supplier provides
5. Click "Create Supplier"

**Performance Tracking**:
- Automatically tracked: On-time delivery %, quality acceptance %
- Update rating based on performance
- Add notes for significant issues
- Archive underperforming suppliers

#### 3. Warehouses & Locations
**What**: Physical storage locations organized by zone and bin

**Structure**:
```
Warehouse (e.g., "Main Warehouse")
├── Zone (e.g., "Zone A - Dry Storage")
│   ├── Bin (e.g., "A-01", "A-02", etc.)
│   └── Bin (e.g., "A-03", "A-04", etc.)
├── Zone (e.g., "Zone B - Cold Storage")
│   ├── Bin (e.g., "B-01", "B-02", etc.)
│   └── ...
└── ...
```

**How to Set Up**:
1. Create Warehouse → Set capacity and address
2. Create Zones within warehouse → Set temperature/humidity if needed
3. Create Bins within zones → Set capacity and track status

**Usage**:
- Store Officer assigns bins during GRN receipt
- System tracks stock by bin for FIFO picking
- Quick bin search and capacity alerts

---

### Production Module

#### Purpose
Manage recipes (BOMs), production scheduling, and batch tracking.

#### 1. Bill of Materials (BOM)

**What**: Recipe defining ingredients and expected yield

**When Used**:
- Before creating production orders
- When formulation changes (create new version)
- For cost calculation and standardization

**How to Create a BOM**:
1. Go to Production → Bill of Materials
2. Click "New BOM" button
3. Fill in recipe info:
   - **Product Name**: What you're making
   - **Finished Product SKU**: Select the finished material
   - **Version**: Usually starts at 1
   - **Expected Yield**: How much you expect to produce
   - **Yield Unit**: kg, liters, units, etc.
   - **Description**: Optional notes
4. Add ingredients:
   - Click "Add Ingredient" row
   - Select material from dropdown
   - Enter quantity (auto-fills unit from material)
   - Choose: Absolute quantity OR Percentage of batch
   - Click "Add Ingredient" to add more
5. Review summary (ingredients added count)
6. Click "Create BOM"

**Version Workflow**:
```
DRAFT (editable) → APPROVED (review-ready) → ACTIVE (use in production)
```

- **DRAFT**: You can edit, only you see it
- **APPROVED**: Locked, awaiting activation
- **ACTIVE**: Official recipe, used for production orders
- Click "Approve" button when ready (only Production Manager or Super Admin)
- Click "Set Active" to make official

**Best Practices**:
- Test with small batch first
- Document deviation reasons
- Keep historical versions for reference
- Use percentages for flexible batch sizes
- Lock BOM before high-volume production

#### 2. Production Orders

**What**: Scheduling a production run from an approved BOM

**How to Create a Production Order**:
1. Go to Production → Production Orders
2. Click "Create Order" button
3. Fill in:
   - **BOM**: Select an ACTIVE BOM
   - **Quantity to Produce**: Target amount
   - **Scheduled Start**: When to begin
   - **Scheduled End**: When complete
   - **Notes**: Any special instructions
4. System auto-calculates required ingredients
5. Check ingredient availability alerts
6. Click "Schedule" to create order

**Status Progression**:
```
SCHEDULED → PROCESSING → COMPLETED (or WASTED)
```

**Monitoring Production**:
1. View active orders in dashboard
2. Track against schedule
3. Update status as production progresses
4. Record actual yield when complete

#### 3. Traceability

**What**: Links finished goods back to ingredient batches

**Usage**:
- Quality assurance: Which ingredients in finished product?
- Recalls: Which batches affected?
- Variance investigation: Why did yield differ?

**How to Trace**:
1. Go to Production → Traceability
2. Enter finished goods code or batch number
3. View full ingredient composition
4. See each ingredient's lot/batch
5. Export traceability report if needed

---

### Inventory Module

#### Purpose
Real-time stock management, receiving, and stock movements.

#### 1. Stock Ledger

**What**: Current inventory levels by location and batch

**How to Check Stock**:
1. Go to Inventory → Stock Ledger
2. View all materials with:
   - Current quantity in each bin
   - Reserved (allocated but not used)
   - Available (ready to use)
   - Expiry date
   - Last movement date/type
3. Click material to see movement history
4. Filter by warehouse, zone, or status

**Stock Status Legend**:
- **Available**: Ready to use
- **Reserved**: Allocated to requisition/production, not yet issued
- **Blocked**: Failed QA, cannot use
- **Expired**: Past expiration date, cannot use

#### 2. Goods Receipt Note (GRN)

**What**: Formal receipt of goods from supplier (PO → GRN)

**How to Create GRN**:
1. Go to Inventory → GRN
2. Click "Receive Goods" button
3. Link to Purchase Order:
   - Select PO from dropdown
   - System auto-fills: supplier, materials, quantities
4. Verify received quantity:
   - Check physical goods against PO
   - Enter actual received quantity (if different)
   - Add notes on discrepancies
5. Assign bin locations:
   - For each material, select destination bin
   - System checks bin capacity
6. Click "Create GRN"
7. Stock ledger automatically updates

**QA Integration**:
- GRN status: Awaiting Inspection
- QA Inspector reviews materials
- QA Approves/Rejects batch
- Only approved materials available for production

#### 3. Stock Movements

**What**: Daily transfers, issues, and adjustments

**Common Movements**:

**Issue to Production**:
1. Go to Inventory → Stock Movements
2. Click "Issue Materials"
3. Select material and quantity
4. Link to production order
5. Click "Issue"
6. Stock automatically decremented

**Bin-to-Bin Transfer**:
1. Go to Inventory → Stock Movements
2. Click "Transfer Stock"
3. Select source and destination bins
4. Enter quantity
5. Click "Transfer"

**Stock Adjustment**:
1. Go to Inventory → Stock Movements
2. Click "Adjust Stock"
3. Reason: Damage, Counting Variance, Write-off, etc.
4. Enter adjustment quantity
5. Upload photo if damaged
6. Click "Record Adjustment"

#### 4. Stock Counts

**What**: Physical verification of inventory

**How to Conduct Stock Count**:
1. Go to Inventory → Stock Counts
2. Click "New Count"
3. Select warehouse/zone
4. System generates list of all bins
5. Physically count items
6. Enter actual count for each bin
7. System calculates variance
8. Review high-variance items
9. Click "Post Count" to update ledger

**Variance Investigation**:
- Variance > 5%: Manual review required
- Possible reasons: Damage, miscounting, unauthorized usage
- Create adjustment movement if needed
- Document reason in notes

---

### Procurement Module

#### Purpose
Purchase order management and supplier coordination.

#### 1. Requisitions

**What**: Material request from Store Officer or Production Manager

**How to Create Requisition** (Store Officer / Production Manager):
1. Go to Procurement → Requisitions
2. Click "Create Requisition"
3. Fill in:
   - **Materials Needed**: Add multiple items
   - **Quantity**: How much needed
   - **Urgency**: Normal / Urgent / Critical
   - **Notes**: Special requirements
4. Click "Submit for Approval"

**Status**: Pending Approval → Awaiting PO → In Stock

**How to Approve Requisition** (Procurement Officer):
1. Go to Procurement → Requisitions
2. Find pending requisitions
3. Review details (quantity, urgency, cost)
4. Click "Approve" to proceed to PO creation
5. Click "Reject" if issues (add feedback notes)

#### 2. Purchase Orders (PO)

**What**: Official order sent to supplier

**How to Create PO** (Procurement Officer):
1. Go to Procurement → Purchase Orders
2. Click "Create PO" button
3. Link to requisition or create manually:
   - Select supplier
   - Add materials and quantities
   - Set delivery date
   - Add delivery notes
4. System calculates total cost
5. Click "Submit PO"
6. Status changes to "Submitted"
7. Send to supplier (email or print)

**Tracking PO**:
1. View expected delivery date
2. Monitor status: Submitted → In Transit → Received
3. Compare received vs. ordered quantities
4. Track on-time delivery % by supplier

#### 3. Supplier Performance

**What**: Metrics for supplier evaluation

**Tracked Metrics**:
- **On-time Delivery %**: % of POs received on or before expected date
- **Quality Acceptance %**: % of materials accepted by QA
- **Price Accuracy**: How often prices match quotes
- **Responsiveness**: How quickly they respond to inquiries

**How to View**:
1. Go to Master Data → Suppliers
2. Click on supplier name
3. See performance dashboard
4. Review recent orders and ratings
5. Add performance notes

---

### Quality Assurance (QA) Module

#### Purpose
Ensure material and product quality through testing and batch management.

#### 1. Material Inspection

**What**: Testing incoming materials from GRN

**How to Inspect** (QA Inspector):
1. Go to QA → Material Inspections
2. View pending inspections (from GRN)
3. Click inspection to open
4. Conduct tests per material specification:
   - Visual inspection (color, texture, odor)
   - Physical tests (weight, density, pH, etc.)
   - Documentation checks (certificates, NAFDAC, etc.)
5. Log test results
6. Compare against acceptable range
7. If all tests pass: Click "Approve Batch"
8. If any test fails: Click "Reject Batch" and add reason
9. Generate test certificate (attach to batch)

#### 2. Batch Release/Block

**What**: Control which batches are available for production

**How to Release a Batch** (QA Inspector):
1. Go to QA → Batch Management
2. View approved batches (passed inspection)
3. Click "Release" to make available for production
4. System automatically creates batch certificate

**How to Block a Batch** (QA Inspector):
1. Go to QA → Batch Management
2. Click on batch with issues
3. Click "Block Batch"
4. Select reason: Failed Test / Damaged / Expired / Recall
5. Add notes
6. Click "Block"
7. Batch marked as unavailable
8. Cannot be used in production

#### 3. Traceability

**What**: Link finished goods to ingredient batches (for recalls)

**How to Generate Traceability Report**:
1. Go to QA → Traceability
2. Enter finished goods code
3. View:
   - All ingredient lots used
   - Production batch details
   - Production date and yield
4. Export report as PDF
5. Use for recall communications if needed

---

### Reports Module

#### Purpose
Business intelligence and analytics

#### Available Reports

**Procurement Reports**:
- Purchase Order Status (pending, delivered, overdue)
- Supplier Performance (on-time %, quality %, price accuracy)
- Delivery Trends (by supplier, by material type)
- Cost Analysis (actual vs. budgeted)

**Production Reports**:
- Production Efficiency (actual yield vs. target)
- BOM Usage (which recipes used, how often)
- Batch Performance (variance analysis)
- Production Schedule vs. Actuals

**Inventory Reports**:
- Stock Levels (current inventory value)
- Inventory Turnover (slow-moving items)
- Expiry Alerts (items expiring soon)
- Stock Adjustments & Write-offs

**Quality Reports**:
- Defect Rates (by supplier, by material type)
- Inspection Results (pass rate, common failures)
- Batch Rejections (reasons, costs)
- Traceability (for recalls or investigations)

**How to Generate Report**:
1. Go to Reports
2. Select report type
3. Set filters:
   - Date range
   - Supplier / Material / Warehouse
   - Status filters
4. Click "Generate"
5. View on screen or export to PDF/Excel

---

## Common Workflows

### Workflow 1: New Material Procurement

**Scenario**: Production Manager needs raw materials for a new recipe

**Steps**:

1. **Super Admin or Procurement Officer**:
   - Add new material to Master Data
   - Add supplier information
   - Link material to supplier

2. **Store Officer**:
   - Create requisition for materials
   - Submit for approval

3. **Procurement Officer**:
   - Review and approve requisition
   - Create purchase order
   - Send to supplier

4. **Supplier**:
   - Prepares and ships goods
   - Provides delivery date

5. **Store Officer**:
   - Receives goods
   - Creates GRN with purchase order link
   - Assigns items to warehouse bins

6. **QA Inspector**:
   - Reviews pending GRN inspection
   - Conducts material tests
   - Approves or rejects batch

7. **Production Manager**:
   - Sees material now available
   - Uses in new BOM
   - Schedules production

### Workflow 2: Recipe Creation & Production

**Scenario**: New product needs a production recipe

**Steps**:

1. **Production Manager**:
   - Creates new BOM
   - Adds ingredients and quantities
   - Sets expected yield
   - Submits for approval

2. **Production Manager** (approval):
   - Reviews BOM
   - Clicks "Approve" to move to review phase
   - Clicks "Set Active" to authorize for production

3. **Production Manager** (scheduling):
   - Creates production order from active BOM
   - Sets target quantity and dates
   - System shows required ingredients
   - System checks availability (alerts on shortages)

4. **Store Officer**:
   - Issues materials to production
   - Records stock movement

5. **Production Team**:
   - Executes production batch
   - Records actual quantities

6. **Production Manager**:
   - Logs actual yield vs. expected
   - System calculates variance percentage

7. **QA Inspector**:
   - Reviews finished batch
   - Conducts quality tests
   - Releases batch to inventory

8. **System**:
   - Auto-assigns 2-year expiration date
   - Makes finished goods available

### Workflow 3: High-Value Inventory Adjustment

**Scenario**: Stock count finds 50 units of expensive material missing

**Steps**:

1. **Store Officer**:
   - Conducts physical stock count
   - Finds variance
   - Creates adjustment movement (damage/loss)
   - Specifies reason and quantity

2. **Executive Admin**:
   - Receives alert on high-value adjustment
   - Reviews details
   - Requests additional documentation if needed

3. **Executive Admin** (approval):
   - Approves adjustment to post to inventory
   - Stock ledger updates

4. **Audit Trail**:
   - All steps logged with user, timestamp, reason
   - Available in audit logs for review

### Workflow 4: Supplier Quality Issue

**Scenario**: QA finds defects in delivered materials

**Steps**:

1. **QA Inspector**:
   - Reviews GRN inspection
   - Finds defects
   - Rejects batch with detailed reason
   - Batch marked as "blocked"

2. **Procurement Officer**:
   - Sees rejection notification
   - Contacts supplier
   - Documents issue

3. **Supplier**:
   - Sends replacement or credit note
   - Store Officer creates new GRN for replacement

4. **System**:
   - Tracks rejection against supplier
   - Updates supplier performance metrics
   - Shows pattern if repeated issues

5. **Executive Admin**:
   - Reviews supplier performance
   - May recommend replacement supplier if issues persist

---

## Troubleshooting

### Common Issues & Solutions

**Issue**: "I can't see a module in my menu"
- **Cause**: Your role doesn't have access to that module
- **Solution**: Check your role permissions (ask Admin) or contact your manager

**Issue**: "I created a BOM but can't use it for production"
- **Cause**: BOM is still in DRAFT status, needs approval first
- **Solution**: Go to BOM, click "Approve", then "Set Active" before creating orders

**Issue**: "Material shows as 'Reserved' and can't be issued"
- **Cause**: Quantity is allocated to another requisition/order
- **Solution**: Check which order has reserved it, or wait for that order to complete

**Issue**: "GRN won't let me post stock update"
- **Cause**: GRN is awaiting QA inspection approval
- **Solution**: Wait for QA Inspector to inspect and approve the batch

**Issue**: "Supplier's on-time delivery % dropped suddenly"
- **Cause**: Recent late delivery updated the metric
- **Solution**: Review recent POs in supplier details to see which deliveries were late

**Issue**: "I forgot my password"
- **Cause**: Authentication issue
- **Solution**: Click "Forgot Password" on login screen or contact Super Admin

**Issue**: "Stock count shows negative quantity"
- **Cause**: System error or data corruption
- **Solution**: Contact Super Admin to investigate audit trail and correct

**Issue**: "Can't find a material in dropdown"
- **Cause**: Material might be inactive or spelled differently
- **Solution**: Go to Master Data → Materials and search for exact name

**Issue**: "PO delivery date is in the past but status not updated"
- **Cause**: Status needs manual update
- **Solution**: Go to PO, update status to "Received", confirm quantities

---

## FAQ

### General Questions

**Q: How often should I take the onboarding tour?**
A: The tour is designed as a one-time first-use experience. You can restart it anytime by clicking Help → "Take Tour". No penalty for repeating.

**Q: Can I change my password?**
A: Go to your Profile (top-right) → Settings → Change Password. You'll need to enter your current password.

**Q: What if I need access to another module?**
A: Contact your manager or Super Admin to request role change. They'll need to update your user role.

**Q: How are my changes tracked?**
A: Every action is logged in audit trail: user, timestamp, what changed, old value, new value. Super Admin can view all audit logs.

### Master Data Questions

**Q: Can I delete a material if it's been used in a BOM?**
A: No, the system prevents deletion to maintain traceability. You can mark it as "INACTIVE" instead.

**Q: How do I update supplier information?**
A: Go to Master Data → Suppliers, click the supplier name, edit fields, click Save.

**Q: What if a material's shelf life changes?**
A: Update the material's shelf life in Master Data. New items received will use the updated shelf life.

### Production Questions

**Q: Can I create a production order without an approved BOM?**
A: No, you must have an ACTIVE BOM. You can only use BOMs in "ACTIVE" status.

**Q: What happens if we produce more than the expected yield?**
A: Record the actual quantity in the production order completion. System will show negative variance %. Review for process improvements.

**Q: How do I cancel a production order?**
A: Go to production order, click "Cancel". Materials marked as reserved will be released back to available inventory.

**Q: Can multiple teams work on the same batch simultaneously?**
A: Not recommended. Batch status moves sequentially (created → processing → completed). Coordinate with your team lead.

### Inventory Questions

**Q: How do I know when stock is running low?**
A: System shows "Low Stock Alert" if quantity falls below reorder level. You'll also get notifications.

**Q: What's the difference between "Available" and "Reserved" stock?**
A: Available = ready to use now. Reserved = allocated to a requisition but not yet issued. Both count toward total stock.

**Q: Can I undo a stock movement?**
A: No, you create a reversal movement instead. Go to Stock Movements → Reverse Movement.

**Q: How do I handle damaged goods received?**
A: During GRN, note the damage. QA Inspector will reject the batch. Contact supplier for replacement.

### Procurement Questions

**Q: How long does a requisition take to become a PO?**
A: Depends on Procurement Officer's review speed (usually same day). Urgent requisitions are prioritized.

**Q: Can I change a PO after it's submitted?**
A: No, you must cancel and create a new one. Contact supplier immediately if changes needed.

**Q: What if a delivery is late?**
A: Update PO status to "Received" with actual date. System automatically tracks late delivery against supplier performance.

**Q: How do I request an expedited delivery?**
A: Add "EXPEDITED" in the PO notes. Procurement Officer can contact supplier about rush shipping.

### QA Questions

**Q: How long does inspection take?**
A: Depends on test complexity (typically 1-24 hours). Urgent materials can be expedited.

**Q: What if a test result is borderline?**
A: Document finding and add notes. You can approve with caveat or reject and request replacement.

**Q: Can I release a batch without all tests complete?**
A: No, all required tests must be completed and passed before release.

**Q: How do I issue a test certificate to a customer?**
A: Go to Batch Details, click "Download Certificate". Share the PDF with customer.

### Reporting Questions

**Q: Can I export reports to Excel?**
A: Yes, most reports have an "Export" button. Choose Excel or PDF format.

**Q: How far back does historical data go?**
A: System keeps all historical data indefinitely. You can query any date range.

**Q: Can I schedule automated reports?**
A: Contact Super Admin to set up scheduled report email delivery.

**Q: What if a report shows incorrect data?**
A: Check audit logs to see if an adjustment or error occurred. Contact Super Admin if suspected data issue.

---

## Support & Resources

### Getting Help

1. **In-App Help**: Click the "?" icon at any time for context-sensitive help
2. **Take Tour**: Restart the role-specific onboarding tour anytime
3. **Documentation**: This guide covers all core functions
4. **Contact Super Admin**: For access issues, password reset, or technical problems

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `?` | Open Help Menu |
| `/` | Open Search |
| `Ctrl+S` or `Cmd+S` | Save (when in form) |
| `Esc` | Close modal/dialog |
| `Ctrl+P` or `Cmd+P` | Print or export |

### Best Practices

✅ **DO**:
- Check stock before scheduling production
- Approve BOMs before using in orders
- Review requisitions before creating POs
- Document reasons for adjustments
- Keep supplier information current
- Follow FIFO (First In, First Out) for picking

❌ **DON'T**:
- Skip QA inspection steps
- Use DRAFT BOMs for production
- Modify POs after submission
- Delete materials with history
- Ignore expiry dates
- Override approval workflows without authorization

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-XX | Initial release |

---

**Last Updated**: January 2024
**Document Owner**: KIB System Administration
**Questions?**: Contact Super Admin or your department lead

