import { Prisma, MaterialRequestStatus, LibraryItemStatus, ScheduleSection } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { settingsService } from "@/lib/services/settings-service";
import { 
  MaterialCatalogInput, 
  LibraryVendorInput, 
  ProjectMaterialRequestInput 
} from "../types";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/lib/services/audit/types";

export class LibraryService {
  private static normalizeOptional(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  /**
   * Returns all active (non-deleted) vendors including contacts.
   * @param tx Prisma transaction client.
   * @returns Sorted vendor list.
   */
  static async getAllVendors(tx: PrismaTransaction) {
    return tx.vendor.findMany({
      where: { deleted_at: null },
      include: { contacts: true },
      orderBy: { brand_name: "asc" },
    });
  }

  /**
   * Returns one active vendor by id with related materials and contacts.
   * @param id Vendor id.
   * @param tx Prisma transaction client.
   * @returns Vendor or null when not found/deleted.
   */
  static async getVendorById(id: string, tx: PrismaTransaction) {
    return tx.vendor.findFirst({
      where: { id, deleted_at: null },
      include: { materials: true, contacts: true },
    });
  }

  /**
   * Creates a vendor and writes audit log.
   * @param data Vendor input payload.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @returns Newly created vendor including contacts.
   */
  static async createVendor(data: LibraryVendorInput, userId: string, tx: PrismaTransaction) {
    const vendor = await tx.vendor.create({
      data: {
        brand_name: data.brand_name,
        company_name: this.normalizeOptional(data.company_name),
        company_pt: this.normalizeOptional(data.company_pt),
        address: this.normalizeOptional(data.address),
        website_url: this.normalizeOptional(data.website_url),
        instagram_url: this.normalizeOptional(data.instagram_url),
        contacts: {
          create: data.contacts?.map((c) => ({
            contact_person: c.contact_person,
            contact_role: c.contact_role,
            phone_number: this.normalizeOptional(c.phone_number),
            email: this.normalizeOptional(c.email),
          })) || [],
        },
      },
      include: { contacts: true },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_VENDOR, "VENDOR", vendor.id, userId, {
      brand_name: vendor.brand_name
    });

    return vendor;
  }

  /**
   * Updates vendor fields and replaces contact list, then writes audit log.
   * @param id Vendor id.
   * @param data Partial vendor payload.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @returns Updated vendor including contacts.
   */
  static async updateVendor(id: string, data: Partial<LibraryVendorInput>, userId: string, tx: PrismaTransaction) {
    const contactData = data.contacts
      ? {
          deleteMany: {},
          create: data.contacts.map((c) => ({
            contact_person: c.contact_person,
            contact_role: c.contact_role,
            phone_number: this.normalizeOptional(c.phone_number),
            email: this.normalizeOptional(c.email),
          })),
        }
      : undefined;

    const vendor = await tx.vendor.update({
      where: { id },
      data: {
        brand_name: data.brand_name,
        company_name: this.normalizeOptional(data.company_name),
        company_pt: this.normalizeOptional(data.company_pt),
        address: this.normalizeOptional(data.address),
        website_url: this.normalizeOptional(data.website_url),
        instagram_url: this.normalizeOptional(data.instagram_url),
        contacts: contactData,
      },
      include: { contacts: true },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_VENDOR, "VENDOR", id, userId, {
      changes: { brand_name: vendor.brand_name }
    });

    return vendor;
  }

  /**
   * Soft-deletes a vendor after orphan-safety check and writes audit log.
   * @param id Vendor id.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @throws {ActionError} VENDOR_HAS_ITEMS when vendor still owns materials.
   * @returns Soft-deleted vendor row.
   */
  static async deleteVendor(id: string, userId: string, tx: PrismaTransaction) {
    const [materialCount] = await Promise.all([
      tx.materialCatalog.count({ where: { vendor_id: id, deleted_at: null } }),
    ]);

    if (materialCount > 0) {
      throw new ActionError(
        "Cannot delete vendor with associated materials. Move or delete materials first.",
        "VENDOR_HAS_ITEMS"
      );
    }

    const vendor = await tx.vendor.update({ 
      where: { id },
      data: { deleted_at: new Date() }
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_DELETE_VENDOR, "VENDOR", id, userId, {
      brand_name: vendor.brand_name
    });

    return vendor;
  }

  /**
   * Reads material catalog list with optional filters.
   * @param tx Prisma transaction client.
   * @param filters Optional list filters.
   * @returns Material catalog rows with vendor and physical samples.
   */
  static async getAllMaterials(
    tx: PrismaTransaction,
    filters?: { 
      category?: string; 
      vendorId?: string; 
      search?: string; 
      hasPhysicalOnly?: boolean; 
      status?: LibraryItemStatus;
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ items: any[]; total: number }> {
    const where: Prisma.MaterialCatalogWhereInput = {
      deleted_at: null
    };

    if (filters?.status) where.status = filters.status;
    if (filters?.category && filters.category !== "all") where.catalog_category = filters.category;
    if (filters?.vendorId) where.vendor_id = filters.vendorId;
    if (filters?.hasPhysicalOnly) {
      where.physical_samples = { some: {} };
    }

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 24;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      tx.materialCatalog.findMany({
        where,
        include: { 
          vendor: { include: { contacts: true } },
          physical_samples: true
        },
        orderBy: [{ catalog_sku: "asc" }, { created_at: "desc" }],
        skip,
        take: pageSize,
      }),
      tx.materialCatalog.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Resolves a vendor by brand name, reviving it if soft-deleted.
   * Part of the Pillar 2 "Anti-Ghosting" strategy.
   * @param brand Brand name to resolve.
   * @param tx Prisma transaction client.
   * @returns Resolved vendor id.
   */
  private static async resolveVendor(brand: string, tx: PrismaTransaction) {
    const normalized = brand.trim();
    if (!normalized) throw new ActionError("Brand name is required", "VENDOR_REQUIRED");

    // We use findFirst instead of upsert here because Prisma's unique 'where' 
    // does not support case-insensitive mode natively without citext.
    const existing = await tx.vendor.findFirst({
      where: { brand_name: { equals: normalized, mode: "insensitive" } }
    });

    if (existing) {
      if (existing.deleted_at) {
        // Revive soft-deleted vendor
        await tx.vendor.update({
          where: { id: existing.id },
          data: { deleted_at: null }
        });
      }
      return existing.id;
    }

    try {
      // Create new vendor if not found
      const created = await tx.vendor.create({
        data: { brand_name: normalized }
      });
      return created.id;
    } catch (error: unknown) {
      // Race condition fallback: if another request created it in between
      if (error instanceof Error && (error as { code?: string }).code === "P2002") {
        const fallback = await tx.vendor.findFirst({
          where: { brand_name: { equals: normalized, mode: "insensitive" } }
        });
        return fallback!.id;
      }
      throw error;
    }
  }

  /**
   * Creates one material catalog row and writes audit log.
   * @param data Material input payload.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @throws {ActionError} when required vendor/category/product type is missing.
   * @returns Created material with relations.
   */
  static async createMaterial(data: MaterialCatalogInput, userId: string, tx: PrismaTransaction) {
    let resolvedVendorId = data.vendor_id;

    // Handle On-the-Go Vendor Creation (Refactored for Anti-Ghosting)
    if (!resolvedVendorId && data.vendor_name?.trim()) {
      resolvedVendorId = await this.resolveVendor(data.vendor_name, tx);
    }


    if (!resolvedVendorId) throw new ActionError("Vendor is required.", "VENDOR_REQUIRED");
    if (!data.catalog_category?.trim()) throw new ActionError("Category is required.", "CATEGORY_REQUIRED");
    if (!data.catalog_sku?.trim()) throw new ActionError("Product type (SKU) is required.", "PRODUCT_TYPE_REQUIRED");

    // Pillar 2: Resolve catalog_brand from vendor if not provided
    let catalogBrand = data.catalog_brand;
    if (!catalogBrand) {
      const vendor = await tx.vendor.findUnique({ where: { id: resolvedVendorId } });
      catalogBrand = vendor?.brand_name || "Unknown Brand";
    }

    // NOTE: Category registration moved to updateMaterial (on APPROVE) to prevent ghost categories.

    const material = await tx.materialCatalog.create({
      data: {
        vendor_id: resolvedVendorId,
        catalog_category: data.catalog_category.trim(),
        catalog_sub_category: this.normalizeOptional(data.catalog_sub_category),
        catalog_sku: data.catalog_sku.trim(),
        catalog_brand: catalogBrand,
        catalog_product_name: this.normalizeOptional(data.catalog_product_name), 
        catalog_motif: this.normalizeOptional(data.catalog_motif),
        tags: data.tags || [],
        catalog_dimension_p: this.normalizeOptional(data.catalog_dimension_p),
        catalog_dimension_l: this.normalizeOptional(data.catalog_dimension_l),
        catalog_dimension_t: this.normalizeOptional(data.catalog_dimension_t),
        catalog_dimension_unit: data.catalog_dimension_unit || "cm",
        catalog_color: this.normalizeOptional(data.catalog_color),
        catalog_finishing: this.normalizeOptional(data.catalog_finishing),
        catalog_image_url: this.normalizeOptional(data.catalog_image_url),
        catalog_image_original_url: this.normalizeOptional(data.catalog_image_original_url),
        catalog_reference_url: this.normalizeOptional(data.catalog_reference_url),
        catalog_folder_url: this.normalizeOptional(data.catalog_folder_url),
        catalog_rak_location: this.normalizeOptional(data.catalog_rak_location),
        catalog_box_number: this.normalizeOptional(data.catalog_box_number),
        catalog_price: data.catalog_price ?? null,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        physical_samples: data.physical_samples ? {
          create: data.physical_samples.map(s => ({
            location_rak: s.location_rak,
            container_box: s.container_box,
            notes: this.normalizeOptional(s.notes)
          }))
        } : undefined
      },
      include: { 
        vendor: { include: { contacts: true } },
        physical_samples: true
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_MATERIAL, "MaterialCatalog", material.id, userId, {
      catalog_sku: material.catalog_sku,
      catalog_category: material.catalog_category,
      brand: material.vendor.brand_name
    });

    return material;
  }

  /**
   * Updates one material and writes audit log.
   * Registers schedule category only when status becomes APPROVED.
   * @param id Material id.
   * @param data Partial material payload.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @returns Updated material with relations.
   */
  static async updateMaterial(id: string, data: Partial<MaterialCatalogInput>, userId: string, tx: PrismaTransaction) {
    if (data.catalog_category !== undefined && !data.catalog_category.trim()) throw new ActionError("Category is required.", "CATEGORY_REQUIRED");
    if (data.catalog_sku !== undefined && !data.catalog_sku.trim()) throw new ActionError("Product type is required.", "PRODUCT_TYPE_REQUIRED");

    // Unified sample update logic: Delete and replace for simplicity in this MVP
    const sampleOps = data.physical_samples ? {
      deleteMany: {},
      create: data.physical_samples.map(s => ({
        location_rak: s.location_rak,
        container_box: s.container_box,
        notes: this.normalizeOptional(s.notes)
      }))
    } : undefined;

    const updated = await tx.materialCatalog.update({
      where: { id },
      data: {
        ...(data.vendor_id ? { vendor: { connect: { id: data.vendor_id } } } : {}),
        ...(data.catalog_category ? { catalog_category: data.catalog_category.trim() } : {}),
        ...(data.catalog_sub_category !== undefined ? { catalog_sub_category: this.normalizeOptional(data.catalog_sub_category) } : {}),
        ...(data.catalog_sku ? { catalog_sku: data.catalog_sku.trim() } : {}),
        ...(data.catalog_brand !== undefined ? { catalog_brand: this.normalizeOptional(data.catalog_brand) } : {}),
        ...(data.catalog_product_name !== undefined ? { catalog_product_name: this.normalizeOptional(data.catalog_product_name) } : {}),
        ...(data.catalog_motif !== undefined ? { catalog_motif: this.normalizeOptional(data.catalog_motif) } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.catalog_dimension_p !== undefined ? { catalog_dimension_p: this.normalizeOptional(data.catalog_dimension_p) } : {}),
        ...(data.catalog_dimension_l !== undefined ? { catalog_dimension_l: this.normalizeOptional(data.catalog_dimension_l) } : {}),
        ...(data.catalog_dimension_t !== undefined ? { catalog_dimension_t: this.normalizeOptional(data.catalog_dimension_t) } : {}),
        ...(data.catalog_dimension_unit !== undefined ? { catalog_dimension_unit: data.catalog_dimension_unit } : {}),
        ...(data.catalog_color !== undefined ? { catalog_color: this.normalizeOptional(data.catalog_color) } : {}),
        ...(data.catalog_finishing !== undefined ? { catalog_finishing: this.normalizeOptional(data.catalog_finishing) } : {}),
        ...(data.catalog_image_url !== undefined ? { catalog_image_url: this.normalizeOptional(data.catalog_image_url) } : {}),
        ...(data.catalog_image_original_url !== undefined ? { catalog_image_original_url: this.normalizeOptional(data.catalog_image_original_url) } : {}),
        ...(data.catalog_reference_url !== undefined ? { catalog_reference_url: this.normalizeOptional(data.catalog_reference_url) } : {}),
        ...(data.catalog_folder_url !== undefined ? { catalog_folder_url: this.normalizeOptional(data.catalog_folder_url) } : {}),
        ...(data.catalog_rak_location !== undefined ? { catalog_rak_location: this.normalizeOptional(data.catalog_rak_location) } : {}),
        ...(data.catalog_box_number !== undefined ? { catalog_box_number: this.normalizeOptional(data.catalog_box_number) } : {}),
        ...(data.catalog_price !== undefined ? { catalog_price: data.catalog_price } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull } : {}),
        status: data.status,
        physical_samples: sampleOps
      },
      include: { 
        vendor: { include: { contacts: true } },
        physical_samples: true
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_MATERIAL, "MaterialCatalog", id, userId, {
      catalog_sku: updated.catalog_sku,
      status: updated.status
    });

    // CRITICAL (fixed): Category registration ONLY on APPROVE
    if (data.status === "APPROVED") {
      await settingsService.executeUpsertScheduleCategoryConfig(tx, {
        section: data.section || ScheduleSection.MATERIAL, 
        category: updated.catalog_category,
        userId,
      });
    }

    return updated;
  }

  /**
   * Syncs a schedule item to the library, ensuring no duplicates.
   * Based on Brand + Name match.
   */
  static async ensureMaterialInLibrary(tx: PrismaTransaction, data: {
    catalog_product_name: string;
    catalog_brand: string;
    catalog_category: string;
    catalog_image_url?: string | null;
    catalog_price?: number | null;
    catalog_image_original_url?: string | null;
    catalog_color?: string | null;
    catalog_finishing?: string | null;
    catalog_motif?: string | null;
  }) {
    if (!data.catalog_brand?.trim()) {
      throw new ActionError("Brand is required for library sync", "BRAND_REQUIRED");
    }
    if (!data.catalog_product_name?.trim()) {
      throw new ActionError("Name is required for library sync", "NAME_REQUIRED");
    }

    const brand = data.catalog_brand.trim();
    const name = data.catalog_product_name.trim();


    // Skip system-reserved brands from being created as vendors
    if (brand === "PENDING" || brand === "RESERVED" || brand === "[RESERVED]") {
      return null; // Return null to indicate no material was synced
    }

    // 1. Resolve Vendor (Refactored for Anti-Ghosting)
    const vendorId = await this.resolveVendor(brand, tx);


    // 2. Resolve Material (Deduplication) - Use try-catch to handle race conditions
    try {
      // First, check if material exists
      const existingMaterial = await tx.materialCatalog.findFirst({
        where: {
          vendor_id: vendorId,
          catalog_sku: { equals: name, mode: "insensitive" }, // Treat name as SKU/Key in this sync context
          deleted_at: null
        }
      });

      if (existingMaterial) {
        if (existingMaterial.status === "APPROVED") {
          // High-End Hardening: Never mutate approved items
          return existingMaterial;
        }

        // Update existing item to sync latest project data
        // If it was REJECTED, reset it to PENDING so admin can review again
        return tx.materialCatalog.update({
          where: { id: existingMaterial.id },
          data: {
            catalog_category: data.catalog_category,
            catalog_image_url: data.catalog_image_url || existingMaterial.catalog_image_url,
            catalog_price: data.catalog_price ?? existingMaterial.catalog_price,
            catalog_image_original_url: data.catalog_image_original_url || existingMaterial.catalog_image_original_url,
            catalog_color: data.catalog_color || existingMaterial.catalog_color,
            catalog_finishing: data.catalog_finishing || existingMaterial.catalog_finishing,
            catalog_motif: data.catalog_motif || existingMaterial.catalog_motif,
            catalog_product_name: data.catalog_product_name || existingMaterial.catalog_product_name,
            status: existingMaterial.status === "REJECTED" ? "PENDING" : existingMaterial.status
          }
        });
      }

      // Create new material - race condition possible if concurrent request
      return await tx.materialCatalog.create({
        data: {
          vendor_id: vendorId,
          catalog_category: data.catalog_category,
          catalog_sku: name, // Name from sync is usually the primary key/SKU
          catalog_product_name: data.catalog_product_name,
          catalog_image_url: data.catalog_image_url,
          catalog_price: data.catalog_price,
          catalog_image_original_url: data.catalog_image_original_url,
          catalog_color: data.catalog_color,
          catalog_finishing: data.catalog_finishing,
          catalog_motif: data.catalog_motif,
          status: "PENDING"
        }
      });
    } catch (error: unknown) {
      // Handle unique constraint violation (P2002) - race condition fallback
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        const foundMaterial = await tx.materialCatalog.findFirst({
          where: {
            vendor_id: vendorId,
            catalog_sku: { equals: name, mode: "insensitive" },
            deleted_at: null
          }
        });
        
        if (foundMaterial) {
          if (foundMaterial.status === "APPROVED") {
            return foundMaterial;
          }
          return tx.materialCatalog.update({
            where: { id: foundMaterial.id },
            data: {
            catalog_category: data.catalog_category,
            catalog_image_url: data.catalog_image_url || foundMaterial.catalog_image_url,
            catalog_price: data.catalog_price ?? foundMaterial.catalog_price,
            catalog_image_original_url: data.catalog_image_original_url || foundMaterial.catalog_image_original_url,
            catalog_color: data.catalog_color || foundMaterial.catalog_color,
            catalog_finishing: data.catalog_finishing || foundMaterial.catalog_finishing,
            catalog_motif: data.catalog_motif || foundMaterial.catalog_motif,
            catalog_product_name: data.catalog_product_name || foundMaterial.catalog_product_name
            }
          });
        }
      }
      throw error;
    }
  }

  /**
   * Soft-deletes one material and writes audit log.
   * @param id Material id.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @returns Soft-deleted material with vendor.
   */
  static async deleteMaterial(id: string, userId: string, tx: PrismaTransaction) {
    // Soft Delete Implementation - Force Soft Delete allowed per SSOT policy
    const material = await tx.materialCatalog.update({ 
      where: { id },
      data: { deleted_at: new Date() },
      include: { vendor: true }
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_DELETE_MATERIAL, "MaterialCatalog", id, userId, {
      catalog_sku: material.catalog_sku,
      brand: material.vendor.brand_name
    });

    return material;
  }

  /**
   * Returns available schedule categories from settings service.
   * @param tx Prisma transaction client.
   * @returns Category names.
   */
  static async getCategories(tx: PrismaTransaction) {
    return settingsService.getAvailableCategories(tx);
  }

  /**
   * Returns all project material requests across projects.
   * @param tx Prisma transaction client.
   * @returns Request rows with material, requester, and project.
   */
  static async getAllMaterialRequests(tx: PrismaTransaction) {
    return tx.projectMaterialRequest.findMany({
      include: {
        material: { 
          include: { 
            vendor: { include: { contacts: true } },
            physical_samples: true
          } 
        },
        requested_by: true,
        project: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  // --- PROJECT MATERIAL REQUESTS ---

  /**
   * Returns material requests for one project.
   * @param projectId Project id.
   * @param tx Prisma transaction client.
   * @returns Project-scoped request rows.
   */
  static async getProjectMaterialRequests(projectId: string, tx: PrismaTransaction) {
    return tx.projectMaterialRequest.findMany({
      where: { project_id: projectId },
      include: {
        material: { 
          include: { 
            vendor: { include: { contacts: true } },
            physical_samples: true
          } 
        },
        requested_by: true,
        project: true,
      },
      orderBy: { created_at: "desc" },
    });
  }

  /**
   * Creates a project material request.
   * Supports auto-harvesting to pending library item for custom requests.
   * @param data Request payload.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @returns Created request with related entities.
   */
  static async createProjectMaterialRequest(
    data: ProjectMaterialRequestInput,
    userId: string,
    tx: PrismaTransaction
  ) {
    let materialId = data.material_id;

    // AUTO-HARVESTING: If it's a custom request, create a PENDING catalog item
    if (!materialId && data.custom_material_name) {
      // 1. Ensure "Project Harvested" vendor exists
      let vendorId: string;
      const customVendor = await tx.vendor.findFirst({
        where: { brand_name: { equals: "PROJECT_HARVESTED", mode: "insensitive" } }
      });

      if (customVendor) {
        vendorId = customVendor.id;
      } else {
        const newVendor = await tx.vendor.create({
          data: { 
            brand_name: "PROJECT_HARVESTED", 
            company_name: "Vendor generated from Project Material Requests" 
          }
        });
        vendorId = newVendor.id;
        
        await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_VENDOR, "VENDOR", vendorId, userId, {
          brand_name: "PROJECT_HARVESTED",
          is_auto_generated: true
        });
      }

      // 2. Create skeletal PENDING material
      const newMaterial = await tx.materialCatalog.create({
        data: {
          vendor_id: vendorId,
          catalog_category: "UNCATEGORIZED", // Default for harvested requests
          catalog_sku: data.custom_material_name.trim(),
          catalog_product_name: data.custom_material_name.trim(),
          status: "PENDING",
          catalog_image_url: this.normalizeOptional(data.cover_url),
          catalog_image_original_url: this.normalizeOptional(data.original_url),
          catalog_reference_url: this.normalizeOptional(data.reference_url),
          metadata: { harvested_from: "PROJECT_REQUEST", project_id: data.project_id }
        }
      });
      materialId = newMaterial.id;

      await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_MATERIAL, "MaterialCatalog", materialId, userId, {
        catalog_sku: newMaterial.catalog_sku,
        harvested_from_project: data.project_id
      });
    }

    const request = await tx.projectMaterialRequest.create({
      data: {
        project_id: data.project_id,
        material_id: materialId || undefined,
        schedule_entry_id: data.schedule_entry_id || undefined,
        schedule_option_id: data.schedule_option_id || undefined,
        custom_material_name: this.normalizeOptional(data.custom_material_name),
        reference_url: this.normalizeOptional(data.reference_url),
        requested_by_id: userId,
        status: MaterialRequestStatus.REQUESTED,
        area_location: this.normalizeOptional(data.area_location),
        is_scheduled: data.is_scheduled ?? true,
        notes: this.normalizeOptional(data.notes),
      },
      include: {
        material: { 
          include: { 
            vendor: { include: { contacts: true } },
            physical_samples: true
          } 
        },
        requested_by: true,
        project: true,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_REQUEST, "ProjectMaterialRequest", request.id, userId, {
      project_id: data.project_id,
      material_id: materialId
    });

    return request;
  }

  /**
   * Updates request status and optional receiver name, then writes audit log.
   * @param id Request id.
   * @param status New request status.
   * @param staffName Optional staff name override for RECEIVED.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @returns Updated request with related entities.
   */
  static async updateProjectMaterialRequestStatus(
    id: string,
    status: MaterialRequestStatus,
    staffName: string | null,
    userId: string,
    tx: PrismaTransaction
  ) {
    const req = await tx.projectMaterialRequest.update({
      where: { id },
      data: {
        status: status,
        staff_name_override: this.normalizeOptional(staffName),
      },
      include: {
        material: { 
          include: { 
            vendor: { include: { contacts: true } },
            physical_samples: true
          } 
        },
        requested_by: true,
        project: true,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_REQUEST_STATUS, "ProjectMaterialRequest", id, userId, {
      status,
      project_id: req.project_id,
      staff_name: staffName || "Logged-in User",
    });

    return req;
  }

  /**
   * Deletes one project material request and writes audit log.
   * @param id Request id.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @returns Deleted request with related entities.
   */
  static async deleteProjectMaterialRequest(id: string, userId: string, tx: PrismaTransaction) {
    const request = await tx.projectMaterialRequest.delete({
      where: { id },
      include: {
        material: { 
          include: { 
            vendor: { include: { contacts: true } },
            physical_samples: true
          } 
        },
        requested_by: true,
        project: true,
      }
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_DELETE_REQUEST, "ProjectMaterialRequest", id, userId, {
      project_id: request.project_id,
      material_id: request.material_id
    });

    return request;
  }
}
