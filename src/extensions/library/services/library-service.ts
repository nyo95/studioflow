import { Prisma, ProductRequestStatus, LibraryItemStatus, ProductType, SampleAction, Role } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { settingsService } from "@/lib/services/settings-service";
import { 
  ProductCatalogInput, 
  LibraryVendorInput, 
  ProjectProductRequestInput,
  ProductCatalogValidationSchema,
  CatalogApprovalValidationSchema,
  ProductCatalogWithRelations
} from "../types";
import { ScheduleOptionSnapshot } from "../../schedule/types";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/lib/services/audit/types";


export class LibraryService {
  private static normalizeOptional(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  /**
   * Records a movement or change in the physical inventory logs.
   */
  static async logSampleAction(
    tx: PrismaTransaction,
    data: {
      sample_id: string;
      action: SampleAction;
      notes?: string | null;
      userId: string;
      taken_by?: string;
      date_out?: Date;
      date_return?: Date;
    }
  ) {
    return tx.sampleMovementLog.create({
      data: {
        sample_id: data.sample_id,
        user_id: data.userId,
        action: data.action,
        notes: data.notes,
        taken_by: data.taken_by,
        date_out: data.date_out,
        date_return: data.date_return
      }
    });
  }

  /**
   * CRITICAL RUNTIME ASSERTION: Blocks mutation if item is a Source of Truth (Catalog)
   */
  static async assertEditable(tx: PrismaTransaction, productId: string, role?: Role) {
    const product = await tx.productCatalog.findUnique({
      where: { id: productId }
    });

    if (product?.status === LibraryItemStatus.APPROVED && role !== Role.ADMIN) {
      throw new ActionError("APPROVED global items are read-only. Only ADMIN can override.", "CATALOG_LOCKED");
    }
  }

  /**
   * CRITICAL RUNTIME ASSERTION: Validates model integrity based on ProductType
   */
  static async assertTypeRules(
    type: ProductType, 
    data: { qty?: number; location?: string },
    context: "SNAPSHOT" | "CATALOG"
  ) {
    if (type === "material") {
      if (data.qty !== undefined || data.location !== undefined) {
        throw new ActionError("Materials are forbidden from having quantity or location data.", "TYPE_RULE_VIOLATION");
      }
    } else if (type === "fixture") {
      if (context === "SNAPSHOT") {
        if (!data.qty || data.qty <= 0) throw new ActionError("Fixtures in projects REQUIRE a quantity > 0.", "TYPE_RULE_VIOLATION");
        if (!data.location?.trim()) throw new ActionError("Fixtures in projects REQUIRE a location.", "TYPE_RULE_VIOLATION");
      }
    }
  }

  /**
   * CRITICAL RUNTIME ASSERTION: Validates product identity and catalog readiness
   */
  static async assertValidProduct(data: ProductCatalogInput, context: "SNAPSHOT" | "CATALOG") {
    if (context === "CATALOG") {
      const result = CatalogApprovalValidationSchema.safeParse(data);
      if (!result.success) {
        throw new ActionError(result.error.issues[0].message, "CATALOG_VALIDATION_ERROR");
      }
    } else {
      const result = ProductCatalogValidationSchema.safeParse(data);
      if (!result.success) {
        throw new ActionError(result.error.issues[0].message, "SNAPSHOT_VALIDATION_ERROR");
      }
    }
    
    // IDENTITY RULE: At least one primary identifier must be non-placeholder
    const placeholders = ["N/A", "UNKNOWN", "PENDING", "-", "—", "[RESERVED]"];
    const isPlaceholder = (val?: string | null) => !val || placeholders.includes(val.trim().toUpperCase());

    const skuInvalid = isPlaceholder(data.catalog_sku);
    const nameInvalid = isPlaceholder(data.catalog_product_name);

    if (skuInvalid && nameInvalid) {
      throw new ActionError("Product requires at least one valid identity (SKU or Name). Placeholders in both are FORBIDDEN.", "PLACEHOLDER_VIOLATION");
    }
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
   * Returns one active vendor by id with related products and contacts.
   * @param id Vendor id.
   * @param tx Prisma transaction client.
   * @returns Vendor or null when not found/deleted.
   */
  static async getVendorById(id: string, tx: PrismaTransaction) {
    return tx.vendor.findFirst({
      where: { id, deleted_at: null },
      include: { products: true, contacts: true },
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
   * Performs a soft-delete on a vendor after orphan-safety check.
   * COMPLIANCE: Adheres to SSOT §7.1 Soft Delete Policy to prevent orphaned historical records.
   * @param id Vendor id.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @throws {ActionError} VENDOR_HAS_ITEMS when vendor still owns active products.
   * @returns Soft-deleted vendor row.
   */
  static async deleteVendor(id: string, userId: string, tx: PrismaTransaction) {
    const [productCount] = await Promise.all([
      tx.productCatalog.count({ where: { vendor_id: id, deleted_at: null } }),
    ]);

    if (productCount > 0) {
      throw new ActionError(
        "Cannot delete vendor with associated products. Move or delete products first.",
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
   * Reads product catalog list with optional filters.
   * @param tx Prisma transaction client.
   * @param filters Optional list filters.
   * @returns Product catalog rows with vendor and physical samples.
   */
  static async getAllProducts(
    tx: PrismaTransaction,
    filters?: { 
      category?: string; 
      vendorId?: string; 
      search?: string; 
      hasPhysicalOnly?: boolean; 
      status?: LibraryItemStatus;
      type?: ProductType;
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ items: ProductCatalogWithRelations[]; total: number }> {
    const where: Prisma.ProductCatalogWhereInput = {
      deleted_at: null
    };

    if (filters?.status) where.status = filters.status;
    if (filters?.category && filters.category !== "all") where.catalog_category = filters.category;
    if (filters?.vendorId) where.vendor_id = filters.vendorId;
    if (filters?.type) where.catalog_type = filters.type;
    
    if (filters?.search) {
      where.OR = [
        { catalog_product_name: { contains: filters.search, mode: "insensitive" } },
        { catalog_brand: { contains: filters.search, mode: "insensitive" } },
        { catalog_sku: { contains: filters.search, mode: "insensitive" } },
        { catalog_sub_category: { contains: filters.search, mode: "insensitive" } },
        { catalog_category: { contains: filters.search, mode: "insensitive" } },
        { catalog_motif: { contains: filters.search, mode: "insensitive" } },
        { catalog_color: { contains: filters.search, mode: "insensitive" } },
        { catalog_finishing: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters?.hasPhysicalOnly) {
      where.physical_samples = { some: {} };
    }

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 24;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      tx.productCatalog.findMany({
        where,
        include: { 
          vendor: { include: { contacts: true } },
          physical_samples: true
        },
        orderBy: [{ catalog_sku: "asc" }, { created_at: "desc" }],
        skip,
        take: pageSize,
      }),
      tx.productCatalog.count({ where }),
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
  private static async resolveVendor(brand: string, userId: string, tx: PrismaTransaction) {
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

        await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_VENDOR, "VENDOR", existing.id, userId, {
          brand_name: existing.brand_name,
          action: "REVIVE_VIA_RESOLUTION"
        });
      }
      return existing.id;
    }

    try {
      // Create new vendor if not found
      const created = await tx.vendor.create({
        data: { brand_name: normalized }
      });

      await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_VENDOR, "VENDOR", created.id, userId, {
        brand_name: normalized,
        source: "RESOLUTION_AUTO_CREATE"
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
   * @returns Created product with relations.
   */
  static async createProduct(data: ProductCatalogInput, userId: string, tx: PrismaTransaction) {
    const resolvedVendorId = data.vendor_id || await this.resolveVendor(data.vendor_name || data.catalog_brand || "", userId, tx);
    
    await this.assertValidProduct(data, "SNAPSHOT");
    await this.assertTypeRules(data.catalog_type || ProductType.material, {}, "SNAPSHOT");

    if (!resolvedVendorId) throw new ActionError("Brand is REQUIRED for catalog entry.", "BRAND_REQUIRED");

    // Resolve catalog_brand from vendor - Hard Fail if vendor deleted
    const vendor = await tx.vendor.findUnique({ where: { id: resolvedVendorId } });
    if (!vendor || vendor.deleted_at) throw new ActionError("Valid Brand is REQUIRED.", "VENDOR_REQUIRED");
    const catalogBrand = vendor.brand_name;

    const product = await tx.productCatalog.create({
      data: {
        vendor_id: resolvedVendorId,
        catalog_category: data.catalog_category.trim(),
        catalog_type: data.catalog_type || ProductType.material,
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
        catalog_color: data.catalog_color.trim(),
        catalog_finishing: this.normalizeOptional(data.catalog_finishing),
        catalog_image_url: this.normalizeOptional(data.catalog_image_url),
        catalog_image_thumbnail_url: this.normalizeOptional(data.catalog_image_thumbnail_url),
        catalog_image_original_url: this.normalizeOptional(data.catalog_image_original_url),
        catalog_reference_url: this.normalizeOptional(data.catalog_reference_url),
        catalog_folder_url: this.normalizeOptional(data.catalog_folder_url),
        catalog_price: data.catalog_price ?? null,
        status: data.status || "APPROVED",
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        physical_samples: data.physical_samples ? {
          create: data.physical_samples.map(s => ({
            rack_number: s.rack_number,
            box_number: s.box_number,
            notes: this.normalizeOptional(s.notes),
            status: s.status || "AVAILABLE",
            current_borrower_name: s.current_borrower_name
          }))
        } : undefined
      },
      include: { 
        vendor: { include: { contacts: true } },
        physical_samples: true
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_PRODUCT, "ProductCatalog", product.id, userId, {
      catalog_sku: product.catalog_sku,
      catalog_category: product.catalog_category,
      brand: product.vendor.brand_name
    });

    return product;
  }

  /**
   * Updates one product and writes audit log.
   * Registers schedule category only when status becomes APPROVED.
   * @param id Product id.
   * @param data Partial product payload.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @returns Updated product with relations.
   */
  static async updateProduct(id: string, data: Partial<ProductCatalogInput>, userId: string, tx: PrismaTransaction, role?: Role) {
    await this.assertEditable(tx, id, role);
    if (data.catalog_category !== undefined && !data.catalog_category.trim()) throw new ActionError("Category is required.", "CATEGORY_REQUIRED");
    
    const existing = await tx.productCatalog.findUnique({ where: { id } });
    if (!existing) throw new ActionError("Product not found", "NOT_FOUND");

    // STRICT: Type Immutability
    if (data.catalog_type !== undefined && existing.catalog_type !== data.catalog_type) {
      throw new ActionError("Product TYPE is immutable after creation.", "IMMUTABILITY_VIOLATION");
    }

    // Unified sample update logic: Delete and replace for simplicity in this MVP
    const sampleOps = data.physical_samples ? {
      deleteMany: {},
      create: data.physical_samples.map(s => ({
        rack_number: s.rack_number,
        box_number: s.box_number,
        notes: this.normalizeOptional(s.notes),
        status: s.status || "AVAILABLE",
        current_borrower_name: s.current_borrower_name
      }))
    } : undefined;

    const updated = await tx.productCatalog.update({
      where: { id },
      data: {
        ...(data.vendor_id ? { vendor: { connect: { id: data.vendor_id } } } : {}),
        ...(data.catalog_category ? { catalog_category: data.catalog_category.trim() } : {}),
        ...(data.catalog_sub_category !== undefined ? { catalog_sub_category: this.normalizeOptional(data.catalog_sub_category) } : {}),
        ...(data.catalog_sku ? { catalog_sku: data.catalog_sku.trim() } : {}),
        ...(data.catalog_brand !== undefined ? { catalog_brand: this.normalizeOptional(data.catalog_brand) } : {}),
        ...(data.catalog_product_name !== undefined ? { catalog_product_name: this.normalizeOptional(data.catalog_product_name) } : {}),
        ...(data.catalog_motif !== undefined ? { catalog_motif: this.normalizeOptional(data.catalog_motif) } : {}),
        ...(data.catalog_type !== undefined ? { catalog_type: data.catalog_type } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.catalog_dimension_p !== undefined ? { catalog_dimension_p: this.normalizeOptional(data.catalog_dimension_p) } : {}),
        ...(data.catalog_dimension_l !== undefined ? { catalog_dimension_l: this.normalizeOptional(data.catalog_dimension_l) } : {}),
        ...(data.catalog_dimension_t !== undefined ? { catalog_dimension_t: this.normalizeOptional(data.catalog_dimension_t) } : {}),
        ...(data.catalog_dimension_unit !== undefined ? { catalog_dimension_unit: data.catalog_dimension_unit } : {}),
        ...(data.catalog_color !== undefined ? { catalog_color: data.catalog_color.trim() } : {}),
        ...(data.catalog_finishing !== undefined ? { catalog_finishing: this.normalizeOptional(data.catalog_finishing) } : {}),
        ...(data.catalog_image_url !== undefined ? { catalog_image_url: this.normalizeOptional(data.catalog_image_url) } : {}),
        ...(data.catalog_image_thumbnail_url !== undefined ? { catalog_image_thumbnail_url: this.normalizeOptional(data.catalog_image_thumbnail_url) } : {}),
        ...(data.catalog_image_original_url !== undefined ? { catalog_image_original_url: this.normalizeOptional(data.catalog_image_original_url) } : {}),
        ...(data.catalog_reference_url !== undefined ? { catalog_reference_url: this.normalizeOptional(data.catalog_reference_url) } : {}),
        ...(data.catalog_folder_url !== undefined ? { catalog_folder_url: this.normalizeOptional(data.catalog_folder_url) } : {}),
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

    // Record Inventory Logs for new samples - ONLY for fixture
    if (data.physical_samples && updated.catalog_type === "fixture") {
      await Promise.all(updated.physical_samples.map(sample => 
        this.logSampleAction(tx, {
          sample_id: sample.id,
          action: SampleAction.CHECK_IN,
          notes: `Inventory updated: Rack ${sample.rack_number}, Box ${sample.box_number}`,
          userId
        })
      ));
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_PRODUCT, "ProductCatalog", id, userId, {
      catalog_sku: updated.catalog_sku,
      status: updated.status
    });

    // CRITICAL: Category registration ONLY on APPROVE
    if (data.status === "APPROVED") {
      await this.assertValidProduct(updated as unknown as ProductCatalogInput, "CATALOG");
      
      await settingsService.executeUpsertScheduleCategoryConfig(tx, {
        section: updated.catalog_type, 
        category: updated.catalog_category,
        userId,
      });

    }

    return updated;
  }

  /**
   * Consolidates duplicate brands/vendors into one target vendor.
   * Pillar 2 Resistance logic: Ensures no broken references in Catalog.
   */
  static async mergeVendors(tx: PrismaTransaction, sourceId: string, targetId: string, userId: string) {
    if (sourceId === targetId) throw new ActionError("Cannot merge vendor into itself.", "MERGE_ERROR");

    const [source, target] = await Promise.all([
      tx.vendor.findUnique({ where: { id: sourceId }, include: { products: true } }),
      tx.vendor.findUnique({ where: { id: targetId } })
    ]);

    if (!source || !target) throw new ActionError("One or both vendors not found.", "NOT_FOUND");

    // Move all products to target vendor
    await tx.productCatalog.updateMany({
      where: { vendor_id: sourceId },
      data: { 
        vendor_id: targetId,
        catalog_brand: target.brand_name
      }
    });

    // Note: Project snapshots are historical; not auto-synced during merge.

    // Soft delete source vendor
    await tx.vendor.update({
      where: { id: sourceId },
      data: { deleted_at: new Date() }
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_MERGE_VENDOR, "VENDOR", targetId, userId, {
      merged_source_id: sourceId,
      source_brand: source.brand_name,
      target_brand: target.brand_name
    });
  }

  /**
   * Syncs a schedule item to the library, ensuring no duplicates.
   * Based on Brand + Name match.
   */
  static async ensureProductInLibrary(tx: PrismaTransaction, userId: string, data: {
    catalog_sku?: string | null;
    catalog_product_name: string;
    catalog_brand: string;
    catalog_category: string;
    catalog_image_url?: string | null;
    catalog_price?: number | null;
    catalog_image_original_url?: string | null;
    catalog_color?: string | null;
    catalog_finishing?: string | null;
    catalog_motif?: string | null;
    catalog_reference_url?: string | null;
    catalog_dimension?: string | null;
    catalog_type?: ProductType;
  }) {
    if (!data.catalog_brand?.trim()) {
      throw new ActionError("Brand is required for library sync", "BRAND_REQUIRED");
    }

    const brand = data.catalog_brand.trim();
    
    // Identity Resolution Hierarchy
    const placeholders = ["N/A", "UNKNOWN", "PENDING", "-", "—", "[RESERVED]"];
    const isPlaceholder = (val?: string | null) => !val || placeholders.includes(val.trim().toUpperCase());

    const rawSku = data.catalog_sku?.trim();
    const rawName = data.catalog_product_name?.trim();

    let effectiveId: string;
    if (!isPlaceholder(rawSku)) {
      effectiveId = rawSku!;
    } else if (!isPlaceholder(rawName)) {
      effectiveId = rawName!;
    } else {
      throw new ActionError("Sync failed: No valid primary identity (SKU or Name) provided.", "IDENTITY_REQUIRED");
    }

    // Skip system-reserved brands from being created as vendors
    if (brand === "PENDING" || brand === "RESERVED" || brand === "[RESERVED]") {
      return null;
    }

    // 1. Resolve Vendor
    const vendorId = await this.resolveVendor(brand, userId, tx);

    // 2. Resolve Product (Deduplication)
    try {
      const existingProduct = await tx.productCatalog.findFirst({
        where: {
          vendor_id: vendorId,
          catalog_sku: { equals: effectiveId, mode: "insensitive" },
          deleted_at: null
        }
      });

      if (existingProduct) {
        if (existingProduct.status === "APPROVED") {
          return existingProduct;
        }

        const existingStatus = existingProduct.status;
        const updated = await tx.productCatalog.update({
          where: { id: existingProduct.id },
          data: {
            catalog_category: data.catalog_category,
            catalog_image_url: data.catalog_image_url || existingProduct.catalog_image_url,
            catalog_price: data.catalog_price ?? existingProduct.catalog_price,
            catalog_image_original_url: data.catalog_image_original_url || existingProduct.catalog_image_original_url,
            catalog_color: data.catalog_color || existingProduct.catalog_color,
            catalog_finishing: data.catalog_finishing || existingProduct.catalog_finishing,
            catalog_motif: data.catalog_motif || existingProduct.catalog_motif,
            catalog_product_name: !isPlaceholder(rawName) ? rawName : existingProduct.catalog_product_name,
            status: existingProduct.status === "REJECTED" ? "PENDING" : existingProduct.status
          }
        });

        await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_PRODUCT, "ProductCatalog", updated.id, userId, {
          catalog_sku: effectiveId,
          catalog_product_name: updated.catalog_product_name,
          catalog_brand: brand,
          source: "PROJECT_SYNC_UPDATE",
          previous_status: existingStatus
        });

        return updated;
      }

      // Create new product
      const created = await tx.productCatalog.create({
        data: {
          vendor_id: vendorId,
          catalog_category: data.catalog_category,
          catalog_sku: effectiveId,
          // NEVER persist placeholder in primary field; use null if name is invalid
          catalog_product_name: !isPlaceholder(rawName) ? rawName : null,
          catalog_image_url: data.catalog_image_url,
          catalog_price: data.catalog_price,
          catalog_image_original_url: data.catalog_image_original_url,
          catalog_color: data.catalog_color || "UNSPECIFIED",
          catalog_finishing: data.catalog_finishing,
          catalog_motif: data.catalog_motif,
          status: "PENDING"
        }
      });

      await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_PRODUCT, "ProductCatalog", created.id, userId, {
        catalog_sku: effectiveId,
        catalog_product_name: created.catalog_product_name,
        catalog_brand: brand,
        source: "PROJECT_SYNC_CREATE"
      });

      return created;
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        const foundProduct = await tx.productCatalog.findFirst({
          where: {
            vendor_id: vendorId,
            catalog_sku: { equals: effectiveId, mode: "insensitive" },
            deleted_at: null
          }
        });
        
        if (foundProduct) {
          if (foundProduct.status === "APPROVED") return foundProduct;
          const fallbackStatus = foundProduct.status;
          const updated = await tx.productCatalog.update({
            where: { id: foundProduct.id },
            data: {
              catalog_category: data.catalog_category,
              catalog_image_url: data.catalog_image_url || foundProduct.catalog_image_url,
              catalog_price: data.catalog_price ?? foundProduct.catalog_price,
              catalog_image_original_url: data.catalog_image_original_url || foundProduct.catalog_image_original_url,
              catalog_color: data.catalog_color || foundProduct.catalog_color,
              catalog_finishing: data.catalog_finishing || foundProduct.catalog_finishing,
              catalog_motif: data.catalog_motif || foundProduct.catalog_motif,
              catalog_product_name: !isPlaceholder(rawName) ? rawName : foundProduct.catalog_product_name
            }
          });

          await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_PRODUCT, "ProductCatalog", updated.id, userId, {
            catalog_sku: effectiveId,
            catalog_product_name: updated.catalog_product_name,
            catalog_brand: brand,
            source: "PROJECT_SYNC_UPDATE",
            previous_status: fallbackStatus
          });

          return updated;
        }
      }
      throw error;
    }
  }

  /**
   * Performs a soft-delete on one product catalog item.
   * COMPLIANCE: Adheres to SSOT §7.1 Soft Delete Policy. Force soft-delete is allowed per policy.
   * @param id Product id.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @returns Soft-deleted product with vendor info.
   */
  static async deleteProduct(id: string, userId: string, tx: PrismaTransaction) {
    // Soft Delete Implementation - Force Soft Delete allowed per SSOT policy
    const product = await tx.productCatalog.update({ 
      where: { id },
      data: { deleted_at: new Date() },
      include: { vendor: true }
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_DELETE_PRODUCT, "ProductCatalog", id, userId, {
      catalog_sku: product.catalog_sku,
      brand: product.vendor.brand_name
    });

    return product;
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
   * Returns all project product requests across projects.
   * @param tx Prisma transaction client.
   * @returns Request rows with product, requester, and project.
   */
  static async getAllProductRequests(tx: PrismaTransaction) {
    return tx.projectProductRequest.findMany({
      include: {
        product_catalog: { 
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

  // --- PROJECT PRODUCT REQUESTS ---

  /**
   * Returns product requests for one project.
   * @param projectId Project id.
   * @param tx Prisma transaction client.
   * @returns Project-scoped request rows.
   */
  static async getProjectProductRequests(projectId: string, tx: PrismaTransaction) {
    return tx.projectProductRequest.findMany({
      where: { project_id: projectId },
      include: {
        product_catalog: { 
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
   * Creates a project product request. Strictly project-local.
   * @param data Request payload.
   * @param userId Actor user id for audit.
   * @param tx Prisma transaction client.
   * @returns Created request with related entities.
   */
  static async createProjectProductRequest(
    data: ProjectProductRequestInput,
    userId: string,
    tx: PrismaTransaction
  ) {
    // Explicitly removed auto-harvesting as per final policy.
    // ProjectProductRequest remains a local request only.

    const request = await tx.projectProductRequest.create({
      data: {
        project_id: data.project_id,
        product_catalog_id: data.product_catalog_id || undefined,
        schedule_entry_id: data.schedule_entry_id || undefined,
        schedule_option_id: data.schedule_option_id || undefined,
        custom_product_name: this.normalizeOptional(data.custom_product_name),
        reference_url: this.normalizeOptional(data.reference_url),
        requested_by_id: userId,
        status: ProductRequestStatus.REQUESTED,
        area_location: this.normalizeOptional(data.area_location),
        is_scheduled: data.is_scheduled ?? true,
        notes: this.normalizeOptional(data.notes),
      },
      include: {
        product_catalog: { 
          include: { 
            vendor: { include: { contacts: true } },
            physical_samples: true
          } 
        },
        requested_by: true,
        project: true,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_REQUEST, "ProjectProductRequest", request.id, userId, {
      project_id: data.project_id,
      product_catalog_id: data.product_catalog_id
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
  static async updateProjectProductRequestStatus(
    id: string,
    status: ProductRequestStatus,
    staffName: string | null,
    userId: string,
    tx: PrismaTransaction
  ) {
    const req = await tx.projectProductRequest.update({
      where: { id },
      data: {
        status: status,
        staff_name_override: this.normalizeOptional(staffName),
      },
      include: {
        product_catalog: { 
          include: { 
            vendor: { include: { contacts: true } },
            physical_samples: true
          } 
        },
        requested_by: true,
        project: true,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_REQUEST_STATUS, "ProjectProductRequest", id, userId, {
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
  static async deleteProjectProductRequest(id: string, userId: string, tx: PrismaTransaction) {
    const request = await tx.projectProductRequest.delete({
      where: { id },
      include: {
        product_catalog: { 
          include: { 
            vendor: { include: { contacts: true } },
            physical_samples: true
          } 
        },
        requested_by: true,
        project: true,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_DELETE_REQUEST, "ProjectProductRequest", id, userId, {
      project_id: request.project_id,
      product_catalog_id: request.product_catalog_id
    });

    return request;
  }

  // --- PROMOTION REQUESTS (APPROVAL QUEUE) ---

  static async getPromotionRequests(tx: PrismaTransaction) {
    return tx.promotionRequest.findMany({
      orderBy: { created_at: "desc" },
    });
  }

  static async getPromotionRequestsWithDetails(tx: PrismaTransaction) {
    const requests = await tx.promotionRequest.findMany({
      orderBy: { created_at: "desc" },
    });

    const scheduleOptionIds = requests.map(r => r.schedule_option_id);
    const projectIds = requests.map(r => r.project_id);
    const userIds = [...requests.map(r => r.requested_by_id), ...requests.filter(r => r.reviewed_by_id).map(r => r.reviewed_by_id!)];

    const [scheduleOptions, projects, users] = await Promise.all([
      scheduleOptionIds.length > 0 ? tx.projectScheduleOption.findMany({
        where: { id: { in: scheduleOptionIds } },
        include: {
          entry: true,
          product_catalog: { include: { vendor: { include: { contacts: true } } } }
        }
      }) : Promise.resolve([]),
      projectIds.length > 0 ? tx.project.findMany({
        where: { id: { in: [...new Set(projectIds)] } }
      }) : Promise.resolve([]),
      userIds.length > 0 ? tx.user.findMany({
        where: { id: { in: [...new Set(userIds)] } }
      }) : Promise.resolve([])
    ]);

    const projectMap = new Map(projects.map(p => [p.id, p]));
    const userMap = new Map(users.map(u => [u.id, u]));
    const optionMap = new Map(scheduleOptions.map(o => [o.id, o]));

    return requests.map(req => ({
      ...req,
      project: projectMap.get(req.project_id),
      schedule_option: optionMap.get(req.schedule_option_id),
      requested_by: userMap.get(req.requested_by_id),
      reviewed_by: userMap.get(req.reviewed_by_id || ""),
    }));
  }

  static async createPromotionRequest(
    tx: PrismaTransaction,
    data: {
      project_id: string;
      schedule_option_id: string;
      requested_by_id: string;
      snapshot_data: unknown;
      notes?: string;
    }
  ) {
    const snapshot = data.snapshot_data as ScheduleOptionSnapshot;

    // Stage 2 Gatekeeping: Mandatory fields for promotion
    const requiredFields = [
      { val: snapshot.specs?.catalog_sku, name: "catalog_sku" },
      { val: snapshot.catalog_product_name, name: "catalog_product_name" },
      { val: snapshot.catalog_brand, name: "catalog_brand" },
      { val: snapshot.catalog_image_url, name: "catalog_image_url" }
    ];

    const missing = requiredFields.filter(f => !f.val || f.val.toString().trim() === "").map(f => f.name);
    if (missing.length > 0) {
      throw new ActionError(`Stage 2 Validation Failed: Missing mandatory fields for promotion: ${missing.join(", ")}`, "VALIDATION_FAILED");
    }

    // Duplicate Protection: One pending request per option
    const existing = await tx.promotionRequest.findFirst({
      where: {
        schedule_option_id: data.schedule_option_id,
        status: "PENDING"
      }
    });
    if (existing) {
      throw new ActionError("A promotion request for this option is already pending review.", "DUPLICATE_REQUEST");
    }

    const request = await tx.promotionRequest.create({
      data: {
        project_id: data.project_id,
        schedule_option_id: data.schedule_option_id,
        requested_by_id: data.requested_by_id,
        snapshot_data: data.snapshot_data as Prisma.InputJsonValue,
        notes: this.normalizeOptional(data.notes),
        status: "PENDING",
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_PROMOTION_REQUEST, "PromotionRequest", request.id, data.requested_by_id, {
      project_id: data.project_id,
      option_id: data.schedule_option_id
    });

    return request;
  }

  static async reviewPromotionRequest(
    tx: PrismaTransaction,
    requestId: string,
    status: "APPROVED" | "REJECTED",
    userId: string,
    notes?: string
  ) {
    const request = await tx.promotionRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new ActionError("Promotion request not found", "NOT_FOUND");
    if (request.status !== "PENDING") throw new ActionError("Request already processed", "INVALID_STATE");

    if (status === "APPROVED") {
      const snapshot = request.snapshot_data as ScheduleOptionSnapshot;
      if (!snapshot) throw new ActionError("Missing snapshot data", "SNAPSHOT_MISSING");

      // 1. Resolve Vendor
      const vendorId = await this.resolveVendor(snapshot.catalog_brand || "Unknown Brand", userId, tx);

      // 1.5 Parse dimensions from canonical string if available
      let dimP = snapshot.specs?.catalog_dimension_p || null;
      let dimL = snapshot.specs?.catalog_dimension_l || null;
      let dimT = snapshot.specs?.catalog_dimension_t || null;
      let dimUnit = snapshot.specs?.catalog_dimension_unit || "cm";

      const canonicalDims = snapshot.specs?.catalog_dimensions;
      if (canonicalDims && typeof canonicalDims === "string" && canonicalDims !== "N/A") {
        const parts = canonicalDims.trim().split(/\s+x\s+/);
        if (parts.length === 3) {
          dimP = parts[0]?.trim() || dimP;
          dimL = parts[1]?.trim() || dimL;
          // Third part might contain unit: "T unit"
          const lastPart = parts[2]?.trim() || "";
          const lastParts = lastPart.split(/\s+/);
          dimT = lastParts[0]?.trim() || dimT;
          if (lastParts.length > 1) {
            dimUnit = lastParts[1]?.trim() || dimUnit;
          }
        }
      }

      // 2. Create Product Catalog Entry
      const product = await tx.productCatalog.create({
        data: {
          vendor_id: vendorId,
          catalog_category: snapshot.schedule_category || "UNCATEGORIZED",
          catalog_type: snapshot.catalog_type || ProductType.material,
          catalog_sub_category: snapshot.catalog_sub_category || null,
          catalog_sku: snapshot.specs?.catalog_sku || "N/A",
          catalog_product_name: snapshot.catalog_product_name || null,
          catalog_brand: snapshot.catalog_brand || null,
          catalog_motif: snapshot.specs?.catalog_motif || null,
          catalog_color: snapshot.specs?.catalog_color || "N/A",
          catalog_finishing: snapshot.specs?.catalog_finishing || null,
          catalog_dimension_p: dimP,
          catalog_dimension_l: dimL,
          catalog_dimension_t: dimT,
          catalog_dimension_unit: dimUnit,
          catalog_image_url: snapshot.catalog_image_url || null,
          catalog_image_original_url: null,
          catalog_reference_url: snapshot.catalog_reference_url || null,
          catalog_price: snapshot.catalog_price || null,
          status: "APPROVED", // Auto-approve promoted items
        }
      });


      // 3. Link back to Project Schedule Option
      await tx.projectScheduleOption.update({
        where: { id: request.schedule_option_id },
        data: {
          product_catalog_id: product.id,
          status: "APPROVED"
        }
      });

      // 4. Record Audit Log for Approval
      await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_APPROVE_PROMOTION, "PromotionRequest", requestId, userId, {
        product_id: product.id,
        project_id: request.project_id
      });
    } else {
      // Record Audit Log for Rejection
      await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_REJECT_PROMOTION, "PromotionRequest", requestId, userId, {
        project_id: request.project_id
      });
    }

    // Update Request Status
    return tx.promotionRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewed_by_id: userId,
        reviewed_at: new Date(),
        notes: notes ? this.normalizeOptional(notes) : undefined,
      },
    });
  }
}
