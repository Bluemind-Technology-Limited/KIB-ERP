# Database Schema Design

This document details the PostgreSQL database schema for the KIB Group Digital Ecosystem. It includes the core authentication tables, the ERP module, the Sales Force Automation (SFA) module, and the Farms/Creations module.

## 1. System Core & Authentication

```sql
-- Core Roles Mapping Table
CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN', 'EXECUTIVE_ADMIN', 'PRODUCTION_MANAGER', 
    'INVENTORY_OFFICER', 'SALES_MANAGER', 'DISTRIBUTOR', 
    'SALES_REP', 'FARM_MANAGER', 'OPERATIONS_OFFICER'
);

CREATE TABLE u_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    phone_number VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE u_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES u_users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'BATCH_COMPLETED', 'ORDER_CREATED'
    module VARCHAR(50) NOT NULL,  -- e.g., 'ERP', 'SFA', 'FARMS'
    ip_address VARCHAR(45),
    user_agent TEXT,
    old_values JSONB,             -- State prior to change
    new_values JSONB,             -- State post change
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. Module 1: Production & Inventory ERP

```sql
CREATE TABLE erp_raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    current_stock NUMERIC(12, 4) DEFAULT 0.0000,
    reorder_threshold NUMERIC(12, 4) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL, -- kg, liters, units
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE erp_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name VARCHAR(150) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE erp_recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES erp_recipes(id) ON DELETE CASCADE,
    material_id UUID REFERENCES erp_raw_materials(id) ON DELETE RESTRICT,
    required_quantity NUMERIC(12, 4) NOT NULL, -- Based on standard batch output
    PRIMARY KEY (recipe_id, material_id)
);

CREATE TABLE erp_prod_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    recipe_id UUID REFERENCES erp_recipes(id) ON DELETE RESTRICT,
    target_quantity NUMERIC(12, 4) NOT NULL,
    actual_yield NUMERIC(12, 4),
    status VARCHAR(50) CHECK (status IN ('SCHEDULED', 'PROCESSING', 'COMPLETED', 'WASTED')) DEFAULT 'SCHEDULED',
    scheduled_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES u_users(id)
);
```

---

## 3. Module 2: Sales Force Automation (SFA)

```sql
CREATE TABLE sfa_distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES u_users(id) ON DELETE CASCADE,
    company_name VARCHAR(200) NOT NULL,
    region VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    credit_limit NUMERIC(15, 2) NOT NULL
);

CREATE TABLE sfa_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    assigned_rep_id UUID REFERENCES u_users(id) ON DELETE SET NULL,
    polygon_geom JSONB NOT NULL -- GeoJSON coordinates stored for Mapbox mapping boundaries
);

CREATE TABLE sfa_customer_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id UUID REFERENCES u_users(id) NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    check_in_lat NUMERIC(10, 7) NOT NULL,
    check_in_lng NUMERIC(10, 7) NOT NULL,
    verified_via_mapbox BOOLEAN DEFAULT FALSE,
    visit_image_r2_url VARCHAR(512), -- Pointer to Cloudflare R2 bucket
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Module 3 & 4: KIB Creations & Farms

```sql
CREATE TABLE farm_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    manager_id UUID REFERENCES u_users(id) ON DELETE SET NULL,
    farm_type VARCHAR(100) NOT NULL, -- Crop, Livestock
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7)
);

CREATE TABLE farm_harvests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID REFERENCES farm_registry(id) ON DELETE CASCADE,
    crop_name VARCHAR(100) NOT NULL,
    quantity_harvested NUMERIC(12, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    harvest_date DATE NOT NULL
);

CREATE TABLE creations_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    file_path_r2 VARCHAR(512) NOT NULL, -- Raw path signature inside R2 bucket
    uploaded_by UUID REFERENCES u_users(id),
    file_size_bytes INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
