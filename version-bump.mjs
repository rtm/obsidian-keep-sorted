import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;
// Set only when run by `npm version`; run directly, it would write "undefined".
if (!targetVersion) {
	console.error("Run this through `npm version`, which sets npm_package_version.");
	process.exit(1);
}

// read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");

// update versions.json with target version and minAppVersion from manifest.json
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");
