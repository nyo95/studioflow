# StudioFlow API Specification (v1.0)

## Overview
> [!WARNING]
> **DEFERRED STATUS**: This API specification is currently **deferred**. The endpoints are implemented but explicitly disabled (`FEATURE_DISABLED`) while the core StudioFlow architecture is finalized.

This document defines the API endpoints and data structures for external integrations, specifically the StudioFlow SketchUp plugin.

## 1. Authentication
All API calls require a Bearer token in the `Authorization` header.
```http
Authorization: Bearer <your_api_token>
```

## 2. SketchUp Integration API

### **POST /api/external/schedule/batch-import**
Initializes or updates schedule entries from SketchUp material data.

#### **Request Body**
```json
{
  "project_id": "string",
  "section": "MATERIAL | FIXTURE",
  "items": [
    {
      "sketchup_id": "string",
      "catalog_sku": "string",
      "catalog_product_name": "string",
      "catalog_brand": "string",
      "qty": 10.5,
      "unit": "m2",
      "metadata": {
        "layer": "string",
        "material_name": "string"
      }
    }
  ]
}
```

#### **Fields Mapping**
| SketchUp Field | StudioFlow Destination | Logic |
|----------------|------------------------|-------|
| Material SKU | `catalog_sku` | primary identifier |
| Material Name | `catalog_product_name` | descriptive name |
| Entity Count | `qty` | calculated quantity |

#### **Snapshot Generation**
Items imported via this endpoint are automatically tagged with `snapshot_source_origin: "sketchup_plugin"`.

## 3. Library Lookup API

### **GET /api/external/library/search**
Search the Material Catalog for matching items to link within SketchUp.

#### **Query Parameters**
- `q`: Search query (SKU or Product Name)
- `category`: Filter by category

## 4. Schedule Retrieval API

### **GET /api/external/schedule/:projectId**
Retrieves the full specified schedule for a project, optimized for SketchUp rendering and tagging.

#### **Response Payload (Flattened)**
```json
[
  {
    "schedule_id": "string",
    "schedule_code": "string",
    "schedule_category": "string",
    "catalog_sku": "string",
    "catalog_product_name": "string",
    "catalog_motif": "string",
    "catalog_color": "string",
    "catalog_finishing": "string",
    "catalog_dimensions": "string",
    "catalog_reference_url": "string",
    "snapshot_captured_at": "datetime"
  }
]
```

---

> [!IMPORTANT]
> **Terminology Compliance**: All integration endpoints MUST use the namespaced `catalog_` prefix for material fields and `snapshot_` for source metadata. Failure to do so will result in validation errors (`SCHEMA_MISMATCH`).
