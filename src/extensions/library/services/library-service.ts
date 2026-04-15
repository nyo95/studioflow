import { PrismaTransaction, AUDIT_ACTIONS } from "@/lib/services/audit/types";
import { insertAuditLog } from "@/actions/_shared";
import { MaterialRequestStatus, LibraryItemStatus } from "@/generated/prisma";
import { 
  LibraryVendorInput, 
  MaterialCatalogInput, 
  ProjectMaterialRequestInput 
} from "../types";

export class LibraryService {
  private static normalizeOptional(val?: string | null) {
    return val?.trim() || null;
  }

  static async getAllVendors(tx: any) {
    return tx.vendor.findMany({
      include: { contacts: true },
      orderBy: { brand_name: "asc" }
    });
  }

  static async createVendor(data: LibraryVendorInput, userId: string, tx: any) {
    const vendor = await tx.vendor.create({
      data: {
        brand_name: data.brand_name.toUpperCase(),
        company_name: this.normalizeOptional(data.company_name),
        contacts: {
          create: data.contacts.map(c => ({
            contact_person: c.contact_person,
            contact_role: c.contact_role,
            phone_number: this.normalizeOptional(c.phone_number),
            email: this.normalizeOptional(c.email)
          }))
        }
      },
      include: { contacts: true }
    });
    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_VENDOR, "VENDOR", vendor.id, userId, { brand_name: vendor.brand_name });
    return vendor;
  }

  static async getAllMaterials(tx: any, filters?: any) {
    return tx.materialCatalog.findMany({
      where: filters,
      include: { vendor: true, physical_samples: true },
      orderBy: { created_at: "desc" }
    });
  }

  static async createMaterial(data: MaterialCatalogInput, userId: string, tx: any) {
    const material = await tx.materialCatalog.create({
      data: {
        vendor_id: data.vendor_id,
        category: data.category.toUpperCase(),
        product_type: data.product_type,
        status: data.status || "APPROVED",
        cover_url: this.normalizeOptional(data.cover_url),
        metadata: data.metadata as any
      },
      include: { vendor: true, physical_samples: true }
    });
    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_MATERIAL, "MaterialCatalog", material.id, userId, { product_type: material.product_type });
    return material;
  }

  static async createProjectMaterialRequest(data: ProjectMaterialRequestInput, userId: string, tx: any) {
    const request = await tx.projectMaterialRequest.create({
      data: {
        project_id: data.project_id,
        material_id: data.material_id,
        custom_material_name: this.normalizeOptional(data.custom_material_name),
        requested_by_id: userId,
        status: MaterialRequestStatus.REQUESTED
      },
      include: { material: true, project: true }
    });
    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_REQUEST, "ProjectMaterialRequest", request.id, userId, { project_id: data.project_id });
    return request;
  }
}
