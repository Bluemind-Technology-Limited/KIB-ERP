# Project Directory Structure

This document details the recommended directory structure for the **KIB Group Digital Ecosystem** codebase. It follows a Domain-Driven design pattern to isolate module-specific views and logic, while sharing core components, hooks, and clients.

## Directory Tree

```
kib-digital-ecosystem/
├── src/
│   ├── assets/              # Brand logos, operational iconography
│   ├── components/          # Shared global UI atomic components
│   │   ├── ui/              # Buttons, inputs, tables, modals (Tailwind styled)
│   │   └── routing/         # Role-Based Access Control (RBAC) guards
│   ├── config/              # Infrastructure keys (Mapbox tokens, API paths, OAuth endpoints)
│   ├── constants/           # Shared status enums, fixed roles, configuration maps
│   ├── context/             # Global low-frequency contexts (Theme, system alerts)
│   ├── hooks/               # Core shared custom hooks
│   │   ├── useAuth.ts       # Session handling, token parsing
│   │   ├── useMapbox.ts     # Isolated Mapbox context initializers
│   │   └── usePWA.ts        # Service worker updates, offline status detections
│   ├── layouts/             # Shared macro layout frames (DashboardLayout, PWAMobileLayout)
│   ├── lib/                 # Third-party client initialization engines
│   │   ├── db.ts            # Dexie.js (IndexedDB local database vault schemas)
│   │   ├── syncEngine.ts    # Background processing & queue flushers
│   │   ├── r2Client.ts      # Cloudflare R2 binary chunk uploading handlers
│   │   └── axiosClient.ts   # Main network client with JWT bearer interceptors
│   ├── modules/             # Strictly isolated sub-systems (Feature domains)
│   │   ├── erp/             # Module 1: Production & Inventory ERP
│   │   │   ├── components/  # ERP-specific micro-components (Formula calculators)
│   │   │   ├── hooks/       # ERP-specific hooks
│   │   │   └── views/       # BatchFormulation, InventoryReconciliation
│   │   ├── sfa/             # Module 2: Sales Force Automation (Mobile PWA Focus)
│   │   │   ├── components/  # SFA-specific layouts
│   │   │   ├── hooks/       # Check-in geolocation watchers
│   │   │   └── views/       # MapRouteView, OrderPlacement, VisitLogging
│   │   ├── creations/       # Module 3: KIB Creations Management Suite
│   │   │   ├── components/  # Document grid managers
│   │   │   └── views/       # OperationalLog, DocumentCenter
│   │   ├── farms/           # Module 4: KIB Farms Management
│   │   │   └── views/       # FarmRegistry, HarvestTracker
│   │   └── admin/           # Module 5: Central Admin Dashboard
│   │       └── views/       # ExecutiveOverview, QuickBooksAuditView, UserManagement
│   ├── routes/              # Consolidated central routing configuration index
│   ├── stores/              # Zustand global reactive state managers
│   │   ├── useAuthStore.ts  # Session variables, identity metadata
│   │   ├── useSfaStore.ts   # SFA specific sync hooks and records
│   │   └── useErpStore.ts   # ERP batch state
│   ├── types/               # Strict TypeScript interfaces matching central DB
│   │   ├── index.ts         # Main structural types (User, Role, Custom visit)
│   │   └── db.types.ts      # Direct schema maps from the relational engine
│   ├── main.tsx
│   └── index.css            # Tailwind directive inputs
├── tailwind.config.js       # Design system tokens and custom palette configurations
├── tsconfig.json            # Target rules and clean path mappings (@/* -> src/*)
└── vite.config.ts           # Vite server optimization rules and PWA plugin hooks
```
