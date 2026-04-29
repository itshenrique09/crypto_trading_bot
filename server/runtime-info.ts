const startedAt = new Date().toISOString();
const buildDefaults = {
  appVersion: process.env.APP_VERSION,
  commit: process.env.BUILD_COMMIT,
  dirty: process.env.BUILD_DIRTY,
  time: process.env.BUILD_TIME,
};

export interface RuntimeEnv {
  [key: string]: string | undefined;
  NODE_ENV?: string;
  APP_VERSION?: string;
  npm_package_version?: string;
  BUILD_COMMIT?: string;
  BUILD_DIRTY?: string;
  BUILD_TIME?: string;
}

export function getRuntimeInfo(env: RuntimeEnv = process.env) {
  const buildDirty = env.BUILD_DIRTY ?? buildDefaults.dirty;

  return {
    app: "cryptotrader-pro",
    nodeEnv: env.NODE_ENV ?? "development",
    version: env.APP_VERSION ?? env.npm_package_version ?? buildDefaults.appVersion ?? "unknown",
    buildCommit: env.BUILD_COMMIT ?? buildDefaults.commit ?? "unknown",
    buildDirty: buildDirty === "true",
    buildTime: env.BUILD_TIME ?? buildDefaults.time ?? "unknown",
    startedAt,
  };
}
