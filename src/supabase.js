import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseReady = Boolean(url && anonKey);
export const supabase = supabaseReady ? createClient(url, anonKey) : null;

/*
 * Small public-catalogue cache. Dataset metadata changes infrequently,
 * while Store / Categories / Explore can otherwise request the same rows
 * repeatedly during navigation. Cache is intentionally short and is cleared
 * after admin mutations.
 */
const CATALOGUE_CACHE_TTL = 30_000;
let datasetsCache = null;
let categoriesCache = null;

function freshCache(entry) {
  return entry && Date.now() - entry.time < CATALOGUE_CACHE_TTL;
}

function clearCatalogueCache() {
  datasetsCache = null;
  categoriesCache = null;
}

export async function signIn(email, password) {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password, fullName = "") {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
}

export async function signOut() {
  if (supabase) return supabase.auth.signOut();
}

export async function getDatasets() {
  if (!supabase) return { data: null, error: null };

  if (freshCache(datasetsCache)) {
    return { data: datasetsCache.data, error: null };
  }

  const result = await supabase
    .from("datasets")
    .select(
      "id,slug,title,description,category_id,location,coverage,price,currency,formats,feature_count,crs,file_size,source,updated_label,thumbnail_url,preview_geojson_url,download_path,status,created_at,updated_at,categories(name)"
    )
    .eq("status", "published")
    // Map Explorer can only display datasets that have a GeoJSON preview.
    // Keep published catalogue records without a preview out of the map.
    .not("preview_geojson_url", "is", null)
    .neq("preview_geojson_url", "")
    .order("created_at", { ascending: false });

  if (!result.error) {
    datasetsCache = {
      data: result.data || [],
      time: Date.now(),
    };
  }

  return result;
}

export async function getDataset(id) {
  if (!supabase) return { data: null, error: null };
  return supabase.from("datasets").select("*").eq("id", id).single();
}

export async function getMyDownloads() {
  if (!supabase) return { data: [], error: null };
  return supabase.from("downloads").select("*, datasets(*)").order("created_at", { ascending: false });
}

export async function getCurrentUserProfile() {
  if (!supabase) return { user: null, profile: null, error: new Error("Supabase is not configured.") };
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { user: null, profile: null, error: userError };
  const user = userData.user;
  if (!user) return { user: null, profile: null, error: null };
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return { user, profile, error };
}

export async function getCategories() {
  if (!supabase) return { data: [], error: null };

  if (freshCache(categoriesCache)) {
    return { data: categoriesCache.data, error: null };
  }

  const result = await supabase
    .from("categories")
    .select("id,name,slug,created_at")
    .order("name");

  if (!result.error) {
    categoriesCache = {
      data: result.data || [],
      time: Date.now(),
    };
  }

  return result;
}

export async function createDatasetWithFiles({
  title, description, categoryId, location, coverage, price,
  formats, featureCount, crs, source, updatedLabel,
  previewFile, previewImageFile, sourceFile
}) {
  if (!supabase) throw new Error("Supabase is not configured.");

  if (!previewFile) {
    throw new Error("GeoJSON preview is required for Map Explorer.");
  }

  // Do not publish a dataset with a missing/invalid GeoJSON preview.
  // The preview is what powers the interactive Map Explorer layer.
  try {
    const previewText = await previewFile.text();
    const previewJson = JSON.parse(previewText);

    if (
      !previewJson ||
      !["FeatureCollection", "Feature", "GeometryCollection"].includes(
        previewJson.type
      )
    ) {
      throw new Error(
        "The uploaded Map Explorer preview must be valid GeoJSON."
      );
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        "The uploaded Map Explorer preview is not valid JSON/GeoJSON."
      );
    }
    throw error;
  }

  const slugBase = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const previewPath = `${slug}/preview.geojson`;
  const { error: previewError } = await supabase.storage
    .from("dataset-previews")
    .upload(previewPath, previewFile, {
      upsert: true,
      contentType: "application/geo+json",
      cacheControl: "31536000",
    });
  if (previewError) throw previewError;

  let thumbnailUrl = null;

  if (previewImageFile) {
    const originalName = previewImageFile.name || "preview";
    const extension = (
      originalName.split(".").pop() || "jpg"
    ).toLowerCase().replace(/[^a-z0-9]/g, "");

    const thumbnailPath = `${slug}/thumbnail.${extension || "jpg"}`;

    const { error: thumbnailError } = await supabase.storage
      .from("dataset-previews")
      .upload(thumbnailPath, previewImageFile, {
        upsert: true,
        contentType: previewImageFile.type || "image/jpeg",
        cacheControl: "31536000",
      });

    if (thumbnailError) throw thumbnailError;

    const { data: thumbnailData } = supabase.storage
      .from("dataset-previews")
      .getPublicUrl(thumbnailPath);

    thumbnailUrl = thumbnailData?.publicUrl || null;
  }

  let downloadPath = null;
  if (sourceFile) {
    downloadPath = `${slug}/${sourceFile.name}`;
    const { error: sourceError } = await supabase.storage
      .from("dataset-files")
      .upload(downloadPath, sourceFile, { upsert: true, contentType: sourceFile.type || "application/zip" });
    if (sourceError) throw sourceError;
  }

  const { data: publicData } = supabase.storage.from("dataset-previews").getPublicUrl(previewPath);

  const { data, error } = await supabase.from("datasets").insert({
    slug,
    title,
    description,
    category_id: categoryId || null,
    location,
    coverage,
    price: Number(price || 0),
    currency: "INR",
    formats,
    feature_count: featureCount,
    crs: crs || "EPSG:4326",
    source,
    updated_label: updatedLabel || new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    thumbnail_url: thumbnailUrl,
    preview_geojson_url: publicData.publicUrl,
    download_path: downloadPath,
    status: "published"
  }).select("*").single();

  if (error) throw error;

  clearCatalogueCache();
  return data;
}


export async function updateDataset(id, changes) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("datasets")
    .update(changes)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  clearCatalogueCache();
  return data;
}

export async function deleteDataset(dataset) {
  if (!supabase) throw new Error("Supabase is not configured.");

  // Delete stored files before deleting the dataset record.
  // Files use the dataset slug as their folder.
  const folder = dataset.slug;

  const listAndRemove = async (bucket) => {
    const { data: objects, error: listError } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
    if (listError) throw listError;
    if (!objects || objects.length === 0) return;

    const paths = objects.map(o => `${folder}/${o.name}`);
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
    if (removeError) throw removeError;
  };

  await listAndRemove("dataset-previews");
  await listAndRemove("dataset-files");

  const { error } = await supabase.from("datasets").delete().eq("id", dataset.id);
  if (error) throw error;

  clearCatalogueCache();
}
