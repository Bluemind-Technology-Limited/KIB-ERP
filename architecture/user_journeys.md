# End-to-End UX User Journeys

This document details the operational user journeys across different modules, from agricultural harvesting to production, route planning, sales, and financial synchronization.

## System Overview Data Flow

```
+---------------+      +-----------------+      +--------------------+      +------------------+
| Farm Registry | ---> | ERP Formulation | ---> | SFA Route Planning | ---> | Distributor App  |
| Crop Harvest  |      | Batch Execution |      | Geofenced Visits   |      | Order Sync to QB |
+---------------+      +-----------------+      +--------------------+      +------------------+
```

---

## 1. Supply & Harvesting (KIB Farms & Creations)

* **Persona:** Farm Manager
* **The Journey:** The Farm Manager logs into the mobile PWA directly from the field. They navigate to the **Farm Module**, tap "Log Harvest", input the yield totals, and add structural notes.
* **System Action:** A background query saves the record locally if offline (using Dexie.js), syncing automatically once service is restored. It posts to the database, signaling to the operational officer via a clean desktop screen that fresh inputs are ready. Any physical quality receipts are scanned, routing straight into an asynchronous chunked upload to Cloudflare R2.

---

## 2. Processing & Production (ERP Layer)

* **Persona:** Production Manager
* **The Journey:** The manager notices the available raw components via the inventory overview screen. They select **Batch Formulation**, pull up a saved structural recipe, and input the target production numbers.
* **System Action:** The interface dynamically runs the raw component subtractions. If any critical item drops below safe levels, an alert is dispatched instantly through the Resend email API to the purchasing desk. The batch moves securely through a workflow from `SCHEDULED` to `PROCESSING`, eventually generating a unique batch tracking number upon completion.

---

## 3. Route Field Sales Operations (SFA Layer)

* **Persona:** Field Sales Representative
* **The Journey:** Opening their PWA on a mobile device, the rep views their daily tasks plotted onto a custom **Mapbox interactive map overlay**. They arrive at a distributor location, trigger an integrated check-in, and capture a photo confirmation.
* **System Action:** The system validates their precise hardware location metrics against the Mapbox territory boundary. The uploaded verification photo goes directly to Cloudflare R2, instantly appending the clean asset URL to the check-in record. The rep fields an item order directly on the interface, which references real-time stock levels.

---

## 4. Administrative Oversight & Financial Sync (Central Dashboard)

* **Persona:** Executive Administrator / Super Admin
* **The Journey:** The executive logs into the desktop suite. They track live production metrics, view mapping statistics, and monitor fulfillment health patterns across all modules.
* **System Action:** As sales orders change to a completed status, an automated background service processes the transaction logs directly into the QuickBooks API over OAuth. The master dashboard updates immediately, displaying verified synchronization indicators alongside matching financial tallies.
