import { buildDownloadSources, buildNotes, formatManifestVersion, isHexSha256, assert } from "./helpers.mjs";
import {
  GitHubClient,
  extractSha256,
  findAsset,
  isReleaseIncompleteError,
  isReleaseNotFoundError,
  resolveReleaseVersion,
  selectRelease,
} from "./github.mjs";

export async function buildAppManifest({
  appConfig,
  appName,
  publicBaseUrl,
  githubToken,
  sourceRevision,
  runNumber,
  client,
}) {
  validateAppConfig(appConfig, appName);

  const updatedAt = new Date();
  const releaseClient = client ?? new GitHubClient({ token: githubToken });
  const manifest = {
    schemaVersion: 1,
    appId: appConfig.appId,
    manifestVersion: formatManifestVersion(updatedAt, runNumber),
    defaultChannel: appConfig.defaultChannel,
    updatedAt: updatedAt.toISOString(),
    channels: {},
  };

  if (sourceRevision) {
    manifest.sourceRevision = sourceRevision;
  }

  const redirects = [];
  let redirectsIncomplete = false;
  const redirectWarnings = [];
  for (const [channelName, channelConfig] of Object.entries(appConfig.channels)) {
    try {
      const {
        entry,
        redirects: channelRedirects,
        redirectsIncomplete: channelRedirectsIncomplete,
        redirectWarnings: channelRedirectWarnings,
      } = await buildChannelEntry({
        channelName,
        channelConfig,
        appConfig,
        client: releaseClient,
      });
      if (entry) {
        manifest.channels[channelName] = entry;
        redirects.push(...channelRedirects);
        redirectsIncomplete = redirectsIncomplete || Boolean(channelRedirectsIncomplete);
        redirectWarnings.push(...(channelRedirectWarnings ?? []));
      }
    } catch (error) {
      if (channelConfig.optional) {
        console.warn(`[dreamapp-updates] skip optional channel ${appName}/${channelName}: ${error.message}`);
        continue;
      }
      const contextualError = new Error(`${appName}/${channelName}: ${error.message}`, { cause: error });
      if (error?.code) {
        contextualError.code = error.code;
      }
      throw contextualError;
    }
  }

  assert(Object.keys(manifest.channels).length > 0, `${appName}: no channels were generated`);
  assert(manifest.channels[manifest.defaultChannel], `${appName}: default channel ${manifest.defaultChannel} was not generated`);
  validateManifest(manifest);

  return {
    appId: appConfig.appId,
    path: appConfig.path,
    manifest,
    manifestUrl: `${publicBaseUrl}/${appConfig.path}/manifest.json`,
    redirects,
    redirectsIncomplete,
    redirectWarnings,
  };
}

async function buildChannelEntry({ channelName, channelConfig, appConfig, client }) {
  const { entry: appEntry, redirects, redirectsIncomplete, redirectWarnings } = await buildAppReleaseEntry({
    channelName,
    appReleaseConfig: channelConfig.app,
    appPath: appConfig.path,
    defaults: appConfig.defaults,
    client,
  });

  const tools = {};
  for (const [toolName, toolConfig] of Object.entries(channelConfig.tools ?? {})) {
    tools[toolName] = await buildToolReleaseEntry({
      toolName,
      toolConfig,
      defaults: appConfig.defaults,
      client,
    });
  }

  return {
    entry: {
      app: appEntry,
      tools,
    },
    redirects,
    redirectsIncomplete,
    redirectWarnings,
  };
}

async function buildAppReleaseEntry({ channelName, appReleaseConfig, appPath, defaults, client }) {
  assert(appReleaseConfig?.source, `channel ${channelName} is missing app source`);

  let release;
  try {
    release = await resolveRelease(client, appReleaseConfig.source, appReleaseConfig.selector);
  } catch (error) {
    if (appReleaseConfig.fallbackRelease && isReleaseNotFoundError(error)) {
      return buildFallbackAppReleaseEntry({ appReleaseConfig, defaults, client });
    }
    throw error;
  }

  const version = resolveReleaseVersion(release, appReleaseConfig.source);
  const platforms = await buildPlatformEntries({
    platformConfigs: appReleaseConfig.platforms,
    release,
    version,
    defaults,
  });
  let redirects = [];
  let redirectsIncomplete = false;
  const redirectWarnings = [];
  try {
    redirects = buildDownloadAliasEntries({
      aliasConfigs: appReleaseConfig.downloadAliases,
      appPath,
      release,
      version,
      defaults,
    });
  } catch (error) {
    if (!isReleaseIncompleteError(error)) {
      throw error;
    }
    redirectsIncomplete = true;
    redirectWarnings.push(error.message);
  }

  return {
    entry: {
      source: toSourceRef(appReleaseConfig.source),
      version,
      publishedAt: release.published_at,
      notes: buildNotes(appReleaseConfig.notes, release.body),
      releasePage: release.html_url,
      platforms,
    },
    redirects,
    redirectsIncomplete,
    redirectWarnings,
  };
}

async function buildFallbackAppReleaseEntry({ appReleaseConfig, defaults, client }) {
  const fallback = appReleaseConfig.fallbackRelease;
  const version = String(fallback?.version || "").trim();
  assert(version, "fallbackRelease.version is required");

  let fallbackSourceRelease;
  let fallbackSourceVersion;
  if (fallback.fromRelease) {
    assert(fallback.fromRelease.source, "fallbackRelease.fromRelease.source is required");
    assert(fallback.fromRelease.selector, "fallbackRelease.fromRelease.selector is required");
    fallbackSourceRelease = await resolveRelease(client, fallback.fromRelease.source, fallback.fromRelease.selector);
    fallbackSourceVersion = resolveReleaseVersion(fallbackSourceRelease, fallback.fromRelease.source);
  }

  const publishedAt = parseFallbackDate(
    fallback.publishedAt ?? fallbackSourceRelease?.published_at,
    "fallbackRelease.publishedAt",
  );
  const releasePage = String(
    String(fallback.releasePage || "").trim() ||
      fallbackSourceRelease?.html_url ||
      `https://github.com/${appReleaseConfig.source.owner}/${appReleaseConfig.source.repo}`,
  ).trim();
  const notes = buildNotes(fallback.notes, fallbackSourceRelease?.body ?? "");
  const platforms = fallback.fromRelease
    ? await buildPlatformEntries({
        platformConfigs: fallback.fromRelease.platforms,
        release: fallbackSourceRelease,
        version: fallbackSourceVersion,
        defaults,
      })
    : fallback.platforms ?? {};

  return {
    entry: {
      source: toSourceRef(appReleaseConfig.source),
      version,
      publishedAt,
      notes,
      releasePage,
      platforms,
    },
    redirects: [],
    redirectsIncomplete: false,
    redirectWarnings: [],
  };
}

function parseFallbackDate(value, label) {
  const rawValue = String(value || "1970-01-01T00:00:00.000Z");
  const parsed = new Date(rawValue);
  assert(!Number.isNaN(parsed.getTime()), `${label} is invalid`);
  return parsed.toISOString();
}

async function buildToolReleaseEntry({ toolName, toolConfig, defaults, client }) {
  assert(toolConfig?.source, `tool ${toolName} is missing source`);
  assert(toolConfig?.upstream?.selector, `tool ${toolName} is missing upstream selector`);
  assert(toolConfig?.recommended?.selector, `tool ${toolName} is missing recommended selector`);

  const upstreamRelease = await resolveRelease(client, toolConfig.source, toolConfig.upstream.selector);
  const recommendedRelease = await resolveRelease(client, toolConfig.source, toolConfig.recommended.selector);
  const recommendedVersion = resolveReleaseVersion(recommendedRelease, toolConfig.source);

  return {
    displayName: toolConfig.displayName,
    kind: toolConfig.kind,
    source: toSourceRef(toolConfig.source),
    upstreamVersion: resolveReleaseVersion(upstreamRelease, toolConfig.source),
    recommendedVersion,
    publishedAt: recommendedRelease.published_at,
    autoUpdate: Boolean(toolConfig.autoUpdate),
    required: Boolean(toolConfig.required),
    notes: buildNotes(toolConfig.notes, recommendedRelease.body),
    releasePage: recommendedRelease.html_url,
    compatibility: {
      minAppVersion: toolConfig.compatibility.minAppVersion,
      maxAppVersion: toolConfig.compatibility.maxAppVersion ?? null,
    },
    platforms: await buildPlatformEntries({
      platformConfigs: toolConfig.platforms,
      release: recommendedRelease,
      version: recommendedVersion,
      defaults,
    }),
  };
}

async function buildPlatformEntries({ platformConfigs, release, version, defaults }) {
  assert(platformConfigs && Object.keys(platformConfigs).length > 0, `release ${release.tag_name} has no platform configs`);

  const platformEntries = {};
  for (const [platformKey, platformConfig] of Object.entries(platformConfigs)) {
    const asset = findAsset(release.assets, platformConfig.asset, {
      version,
      tag: release.tag_name,
    });
    const sha256 = extractSha256(asset);
    assert(isHexSha256(sha256), `asset ${asset.name} has invalid sha256`);

    const entry = {
      artifactName: asset.name,
      contentType: asset.content_type || "application/octet-stream",
      size: asset.size,
      sha256,
      sources: buildDownloadSources(
        platformConfig.downloadSources ?? defaults.downloadSources,
        asset.browser_download_url,
      ),
    };

    if (platformConfig.install?.strategy) {
      entry.installStrategy = platformConfig.install.strategy;
    }
    if (platformConfig.install?.artifactType) {
      entry.artifactType = platformConfig.install.artifactType;
    }
    if (platformConfig.install?.executableName) {
      entry.executableName = platformConfig.install.executableName;
    }
    if (Array.isArray(platformConfig.install?.binaries) && platformConfig.install.binaries.length > 0) {
      entry.binaries = platformConfig.install.binaries;
    }

    platformEntries[platformKey] = entry;
  }

  return platformEntries;
}

async function resolveRelease(client, sourceConfig, selector) {
  assert(sourceConfig.provider === "github-release", `unsupported source provider: ${sourceConfig.provider}`);
  const releases = await client.listReleases({
    owner: sourceConfig.owner,
    repo: sourceConfig.repo,
  });
  return selectRelease(releases, selector);
}

function toSourceRef(sourceConfig) {
  return {
    provider: sourceConfig.provider,
    owner: sourceConfig.owner,
    repo: sourceConfig.repo,
  };
}

function buildDownloadAliasEntries({ aliasConfigs, appPath, release, version, defaults }) {
  if (!Array.isArray(aliasConfigs) || aliasConfigs.length === 0) {
    return [];
  }

  return aliasConfigs.map((aliasConfig) => {
    const route = String(aliasConfig?.route || "").trim().replace(/^\/+/, "");
    assert(route, `release ${release.tag_name} is missing a download alias route`);

    const asset = findAsset(release.assets, aliasConfig.asset, {
      version,
      tag: release.tag_name,
    });
    const sources = buildDownloadSources(
      aliasConfig.downloadSources ?? defaults.downloadSources,
      asset.browser_download_url,
    );
    const enabledSources = sources.filter((source) => source.enabled !== false);
    const sourceName = String(aliasConfig.sourceName || "").trim();
    const selectedSource = sourceName
      ? enabledSources.find((source) => source.name === sourceName)
      : enabledSources[0];

    assert(selectedSource, `download alias ${route} source not found`);

    return {
      from: `/${String(appPath || "").replace(/^\/+|\/+$/g, "")}/${route}`,
      to: selectedSource.url,
      status: Number(aliasConfig.statusCode ?? 302),
    };
  });
}

function validateAppConfig(appConfig, appName) {
  assert(appConfig.path, `${appName}: path is required`);
  assert(appConfig.appId, `${appName}: appId is required`);
  assert(appConfig.defaultChannel, `${appName}: defaultChannel is required`);
  assert(appConfig.defaults?.downloadSources?.length > 0, `${appName}: defaults.downloadSources is required`);
  assert(appConfig.channels && Object.keys(appConfig.channels).length > 0, `${appName}: channels are required`);
}

function validateManifest(manifest) {
  assert(Number.isInteger(manifest.schemaVersion), "schemaVersion must be an integer");
  assert(manifest.defaultChannel in manifest.channels, `defaultChannel ${manifest.defaultChannel} is missing`);

  for (const [channelName, channel] of Object.entries(manifest.channels)) {
    assert(channel.app, `channel ${channelName} is missing app section`);
    validatePlatforms(channel.app.platforms, `${channelName}.app`, { required: false });

    for (const [toolName, tool] of Object.entries(channel.tools)) {
      assert(tool.kind === "external-tool", `tool ${channelName}/${toolName} has invalid kind`);
      validatePlatforms(tool.platforms, `${channelName}.tools.${toolName}`);
    }
  }
}

function validatePlatforms(platforms, label, { required = true } = {}) {
  assert(platforms && typeof platforms === "object", `${label} platforms are required`);
  if (required) {
    assert(Object.keys(platforms).length > 0, `${label} has no platforms`);
  }

  for (const [platformKey, platform] of Object.entries(platforms)) {
    assert(platform.artifactName, `${label}.${platformKey} artifactName is required`);
    assert(platform.sources?.length > 0, `${label}.${platformKey} sources are required`);
    assert(isHexSha256(platform.sha256), `${label}.${platformKey} sha256 is invalid`);
  }
}
