import { readFileSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { readFile } from 'fs/promises';

// Read vault path: ~/.obsidian-dev.json (central) takes precedence, then deploy.config.json (per-repo)
let vaultPath;
for (const configPath of [join(homedir(), '.obsidian-dev.json'), 'deploy.config.json']) {
    let text;
    try {
        text = readFileSync(configPath, 'utf8');
    } catch (e) {
        if (e.code === 'ENOENT') continue;
        throw e;
    }
    // Parse outside the try, so a malformed config reports its syntax error
    // instead of looking like a missing one.
    const config = JSON.parse(text);
    // vaultPaths maps process.platform -> path, so one config can serve a
    // vault reached by different paths from Windows and WSL. vaultPath is
    // the single-path fallback for configs that predate it.
    const resolved = config.vaultPaths?.[process.platform] || config.vaultPath;
    if (resolved) {
        vaultPath = resolved;
        break;
    }
}
if (!vaultPath) {
    console.error(`Error: No vault path found for platform "${process.platform}".`);
    console.error('Set it in ~/.obsidian-dev.json or deploy.config.json, as either:');
    console.error('  { "vaultPath": "/path/to/your/vault" }');
    console.error('  { "vaultPaths": { "win32": "C:\\\\path\\\\to\\\\vault", "linux": "/path/to/vault" } }');
    process.exit(1);
}

// Read plugin ID from manifest
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const pluginDir = join(vaultPath, '.obsidian', 'plugins', manifest.id);

// Ensure plugin directory exists
mkdirSync(pluginDir, { recursive: true });

// Copy built files
for (const file of ['main.js', 'manifest.json']) {
    copyFileSync(file, join(pluginDir, file));
    console.log(`Copied ${file} → ${pluginDir}/`);
}
