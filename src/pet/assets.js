const DEFAULT_ASSET_BASE = new URL("../../assets/pet/", import.meta.url);
const MANIFEST_FILE = "manifest.json";

export async function loadPetCatalog(options = {}) {
  const baseUrl = resolveBaseUrl(options.assetBase);
  const manifest = options.assetManifest ?? (await loadJson(new URL(MANIFEST_FILE, baseUrl)));
  const assets = resolveAssetFiles(manifest.files, baseUrl);
  const actions = await loadActionConfigs(manifest.actions, baseUrl);

  return {
    actions,
    assets,
    manifest,
  };
}

export function collectAssetPaths(assets) {
  return collectImagePaths(assets).filter((path) => !path.includes("/reference/"));
}

async function loadActionConfigs(actionFiles = {}, baseUrl) {
  const entries = await Promise.all(
    Object.entries(actionFiles).map(async ([name, file]) => [
      name,
      await loadJson(new URL(file, baseUrl)),
    ])
  );

  return Object.fromEntries(entries);
}

async function loadJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load pet catalog: ${url.href}`);
  }

  return response.json();
}

function resolveAssetFiles(files = {}, baseUrl) {
  return mapValues(files, (value) => {
    if (typeof value === "string") {
      return new URL(value, baseUrl).href;
    }

    return resolveAssetFiles(value, baseUrl);
  });
}

function collectImagePaths(value) {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectImagePaths);
  }

  return Object.values(value).flatMap(collectImagePaths);
}

function mapValues(source, mapper) {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, mapper(value, key)])
  );
}

function resolveBaseUrl(assetBase) {
  if (!assetBase) {
    return DEFAULT_ASSET_BASE;
  }

  const base =
    assetBase instanceof URL
      ? assetBase
      : new URL(
          assetBase,
          typeof document !== "undefined" ? document.baseURI : import.meta.url
        );

  return ensureDirectoryUrl(base);
}

function ensureDirectoryUrl(url) {
  if (url.href.endsWith("/")) {
    return url;
  }

  return new URL(`${url.href}/`);
}
