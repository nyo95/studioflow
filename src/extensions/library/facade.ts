import {
  createPromotionRequestAction,
  createProjectProductRequestAction,
  getProductsAction,
  getVendorsAction,
} from "./actions/library-actions";
import { uploadLibraryImage } from "./lib/upload-client";
import type { PrismaTransaction } from "@/types/common";
import type { LibraryVendorInput, ProductCatalogInput } from "./types";
import type { ProductCatalogWithRelations, LibraryVendor } from "./types";

/**
 * Library Extension Facade
 * 
 * This is the ONLY legal entry point for other extensions (like Schedule) 
 * to interact with the Library/Catalog domain. 
 * 
 * For server-side operations (createVendor, createProduct), directly import 
 * LibraryService from the service module in server contexts.
 */
export const LibraryFacade = {
  /**
   * Promotions & Requests
   */
  requestPromotionFromSnapshot: createPromotionRequestAction,
  createProjectProductRequest: createProjectProductRequestAction,
  searchProducts: getProductsAction,
  getVendors: getVendorsAction,

  /**
   * Client-side utilities
   */
  uploadProductImage: uploadLibraryImage,
};

/**
 * Re-export types for cross-extension use
 */
export type { ProductCatalogWithRelations, LibraryVendor } from "./types";
