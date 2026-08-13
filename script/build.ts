import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";

// Server deps bundled INTO dist/index.cjs; everything else stays external.
const allowlist = [
  "express",
  "zod",
  "sql.js",
];

function readGit(args: string[], fallback: string) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return fallback;
  }
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));
  const buildCommit = readGit(["rev-parse", "--short", "HEAD"], "unknown");
  const buildDirty = readGit(["status", "--porcelain"], "").length > 0;
  const buildTime = new Date().toISOString();

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.APP_VERSION": JSON.stringify(pkg.version ?? "unknown"),
      "process.env.BUILD_COMMIT": JSON.stringify(buildCommit),
      "process.env.BUILD_DIRTY": JSON.stringify(String(buildDirty)),
      "process.env.BUILD_TIME": JSON.stringify(buildTime),
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Copy sql.js WASM file to dist so it works in production
  const wasmSrc = join("node_modules", "sql.js", "dist", "sql-wasm.wasm");
  if (existsSync(wasmSrc)) {
    await copyFile(wasmSrc, "dist/sql-wasm.wasm");
    console.log("copied sql-wasm.wasm to dist/");
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
