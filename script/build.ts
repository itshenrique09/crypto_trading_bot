import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const allowlist = [
  "express",
  "express-session",
  "memorystore",
  "ws",
  "zod",
  "zod-validation-error",
  "sql.js",
];

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

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
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
