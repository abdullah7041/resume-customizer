// src/services/supabaseExport.js
// Export optimized resumes to Supabase Storage

import { supabase, AppError } from "./supabase.js";

const EXPORT_BUCKET = "resume-exports";

/**
 * Convert HTML to Blob for storage
 */
const htmlToBlob = (htmlContent) => {
  return new Blob([htmlContent], { type: "text/html; charset=utf-8" });
};

/**
 * Generate a unique filename with timestamp
 */
const generateFileName = (baseName = "Resume_Optimized") => {
  const date = new Date();
  const timestamp = date.toISOString().split("T")[0]; // YYYY-MM-DD
  const random = Math.random().toString(36).substring(2, 8);
  return `${baseName}_${timestamp}_${random}.html`;
};

/**
 * Ensure the export bucket exists
 */
const ensureExportBucket = async () => {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === EXPORT_BUCKET);

    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(EXPORT_BUCKET, {
        public: false,
        fileSizeLimit: 10485760, // 10MB
      });

      if (error && !error.message?.includes("already exists")) {
        console.warn("Could not create export bucket:", error);
        // Continue anyway - bucket might exist but API returned error
      }
    }
  } catch (error) {
    console.warn("Bucket check failed:", error);
    // Continue anyway - we'll try to upload and handle errors there
  }
};

/**
 * Export optimized resume to Supabase Storage
 */
export const exportToSupabase = async ({ 
  htmlContent, 
  fileName = "Resume_Optimized",
  metadata = {} 
}) => {
  // Validate input
  if (!htmlContent || typeof htmlContent !== "string") {
    throw new AppError({
      code: "export/invalid-content",
      message: "Invalid HTML content provided",
      hint: "Please generate the resume first before exporting.",
    });
  }

  // Check authentication
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AppError({
      code: "auth/unauthenticated",
      message: "Sign in to save your resume",
      hint: "Log in to store your optimized resume securely.",
    });
  }

  try {
    // Ensure bucket exists
    await ensureExportBucket();

    // Convert HTML to Blob
    const blob = htmlToBlob(htmlContent);
    const uniqueFileName = generateFileName(fileName);
    const filePath = `${user.id}/exports/${uniqueFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(EXPORT_BUCKET)
      .upload(filePath, blob, {
        cacheControl: "3600",
        upsert: true,
        contentType: "text/html; charset=utf-8",
      });

    if (error) {
      throw new AppError({
        code: "export/upload-failed",
        message: "Failed to save resume to storage",
        hint: error.message || "Please try again.",
      });
    }

    // Get public URL (if bucket is public) or signed URL (if private)
    const { data: urlData } = await supabase.storage
      .from(EXPORT_BUCKET)
      .createSignedUrl(filePath, 3600 * 24 * 7); // 7 days

    // Save metadata to database (optional - for listing user's exports)
    const exportRecord = {
      user_id: user.id,
      file_path: filePath,
      file_name: uniqueFileName,
      storage_bucket: EXPORT_BUCKET,
      created_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        file_size: blob.size,
        mime_type: "text/html",
      },
    };

    // Try to save to database (table might not exist yet)
    try {
      await supabase.from("resume_exports").insert(exportRecord);
    } catch (dbError) {
      console.warn("Could not save export record to database:", dbError);
      // Continue anyway - file is still saved in storage
    }

    return {
      success: true,
      filePath: data.path,
      fileName: uniqueFileName,
      signedUrl: urlData?.signedUrl,
      message: "Resume saved successfully to your account",
    };
  } catch (error) {
    console.error("Supabase export error:", error);
    
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError({
      code: "export/failed",
      message: error.message || "Failed to export resume",
      hint: "Please try again or contact support if the issue persists.",
    });
  }
};

/**
 * List user's exported resumes
 */
export const listExports = async () => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AppError({
      code: "auth/unauthenticated",
      message: "Sign in to view your exports",
      hint: "Log in to access your saved resumes.",
    });
  }

  try {
    // List files from storage
    const { data: files, error } = await supabase.storage
      .from(EXPORT_BUCKET)
      .list(`${user.id}/exports`);

    if (error) {
      throw error;
    }

    return files || [];
  } catch (error) {
    console.error("Failed to list exports:", error);
    return [];
  }
};

/**
 * Download an exported resume
 */
export const downloadExport = async (filePath) => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AppError({
      code: "auth/unauthenticated",
      message: "Sign in to download your resume",
      hint: "Log in to access your saved resumes.",
    });
  }

  try {
    const { data, error } = await supabase.storage
      .from(EXPORT_BUCKET)
      .createSignedUrl(filePath, 60); // 1 minute

    if (error) {
      throw error;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Failed to get download URL:", error);
    throw new AppError({
      code: "export/download-failed",
      message: "Failed to download resume",
      hint: error.message || "Please try again.",
    });
  }
};

/**
 * Delete an exported resume
 */
export const deleteExport = async (filePath) => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AppError({
      code: "auth/unauthenticated",
      message: "Sign in to delete your resume",
      hint: "Log in to manage your saved resumes.",
    });
  }

  try {
    const { error } = await supabase.storage
      .from(EXPORT_BUCKET)
      .remove([filePath]);

    if (error) {
      throw error;
    }

    // Delete from database if record exists
    try {
      await supabase
        .from("resume_exports")
        .delete()
        .eq("file_path", filePath)
        .eq("user_id", user.id);
    } catch (dbError) {
      console.warn("Could not delete export record from database:", dbError);
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to delete export:", error);
    throw new AppError({
      code: "export/delete-failed",
      message: "Failed to delete resume",
      hint: error.message || "Please try again.",
    });
  }
};

/**
 * Check if Supabase export is available
 */
export const isSupabaseExportAvailable = () => {
  return Boolean(supabase && import.meta.env.VITE_SUPABASE_URL);
};
