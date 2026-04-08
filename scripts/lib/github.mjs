import { assert, normalizeVersion, renderTemplate } from "./helpers.mjs";

const DEFAULT_API_BASE_URL = "https://api.github.com";
const DEFAULT_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "dreamapp-updates-builder",
};

export class GitHubClient {
  constructor({ token = "", apiBaseUrl = DEFAULT_API_BASE_URL } = {}) {
    this.token = token.trim();
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
    this.releaseCache = new Map();
  }

  async listReleases({ owner, repo }) {
    const cacheKey = `${owner}/${repo}`;
    if (this.releaseCache.has(cacheKey)) {
      return this.releaseCache.get(cacheKey);
    }

    const response = await this.request(`/repos/${owner}/${repo}/releases?per_page=100`);
    const payload = await response.json();
    const releases = [...payload].sort((left, right) => {
      const leftTime = Date.parse(left.published_at || left.created_at || 0);
      const rightTime = Date.parse(right.published_at || right.created_at || 0);
      return rightTime - leftTime;
    });

    this.releaseCache.set(cacheKey, releases);
    return releases;
  }

  async request(pathname, { headers = {} } = {}) {
    const targetUrl = pathname.startsWith("http") ? pathname : `${this.apiBaseUrl}${pathname}`;
    const requestHeaders = {
      ...DEFAULT_HEADERS,
      ...headers,
    };
    if (this.token) {
      requestHeaders.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(targetUrl, {
      headers: requestHeaders,
      redirect: "follow",
    });
    if (!response.ok) {
      const body = await safeReadText(response);
      const detail = body ? `: ${body.slice(0, 200)}` : "";
      throw new Error(`GitHub request failed (${response.status}) ${targetUrl}${detail}`);
    }
    return response;
  }

  async fetchAssetContent(asset, { as = "text" } = {}) {
    assert(asset?.url, `asset url is missing for ${asset?.name ?? "unknown asset"}`);
    const response = await this.request(asset.url, {
      headers: {
        Accept: "application/octet-stream",
      },
    });

    if (as === "buffer") {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    return response.text();
  }
}

export class ReleaseIncompleteError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ReleaseIncompleteError";
    this.code = "ERR_RELEASE_INCOMPLETE";
    Object.assign(this, details);
  }
}

export function selectRelease(releases, selector) {
  assert(selector?.type, "release selector type is required");
  const usableReleases = releases.filter((release) => !release.draft);

  switch (selector.type) {
    case "latest": {
      const wantsPrerelease = Boolean(selector.prerelease);
      const match = usableReleases.find((release) => Boolean(release.prerelease) === wantsPrerelease);
      if (!match) {
        throw new Error(`no ${wantsPrerelease ? "prerelease" : "stable release"} found`);
      }
      return match;
    }
    case "tag": {
      const targetTag = String(selector.tag || "").trim();
      assert(targetTag, "tag selector requires a tag");
      const match = usableReleases.find((release) => release.tag_name === targetTag);
      if (!match) {
        throw new Error(`release tag not found: ${targetTag}`);
      }
      return match;
    }
    default:
      throw new Error(`unsupported release selector type: ${selector.type}`);
  }
}

export function resolveReleaseVersion(release, sourceConfig) {
  return normalizeVersion(release.tag_name, sourceConfig.versionPrefixes ?? ["v"]);
}

export function findAsset(assets, assetSpec, variables) {
  assert(assetSpec, "asset spec is required");

  if (assetSpec.name) {
    const expectedName = renderTemplate(assetSpec.name, variables);
    const match = assets.find((asset) => asset.name === expectedName);
    if (!match) {
      throw new ReleaseIncompleteError(`release asset not found: ${expectedName}`, {
        expectedAssetName: expectedName,
        releaseTag: variables?.tag,
        releaseVersion: variables?.version,
      });
    }
    return match;
  }

  if (assetSpec.match) {
    const pattern = new RegExp(renderTemplate(assetSpec.match, variables));
    const match = assets.find((asset) => pattern.test(asset.name));
    if (!match) {
      throw new ReleaseIncompleteError(`release asset match not found: ${pattern.source}`, {
        expectedAssetPattern: pattern.source,
        releaseTag: variables?.tag,
        releaseVersion: variables?.version,
      });
    }
    return match;
  }

  throw new Error("asset spec requires either name or match");
}

export function extractSha256(asset) {
  const digest = String(asset?.digest || "").trim();
  if (!digest.toLowerCase().startsWith("sha256:")) {
    throw new ReleaseIncompleteError(`asset ${asset?.name ?? "unknown"} is missing sha256 digest`, {
      assetName: asset?.name ?? "",
    });
  }
  return digest.slice("sha256:".length);
}

export function isReleaseIncompleteError(error) {
  return Boolean(
    error &&
      (error.code === "ERR_RELEASE_INCOMPLETE" ||
        error.name === "ReleaseIncompleteError" ||
        isReleaseIncompleteError(error.cause)),
  );
}

async function safeReadText(response) {
  try {
    return (await response.text()).trim();
  } catch {
    return "";
  }
}
