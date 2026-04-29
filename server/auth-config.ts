export function getRequiredAuthPassword(nodeEnv: string | undefined, appPassword: string | undefined): string {
  const password = appPassword ?? "";
  if (nodeEnv === "production" && password.length === 0) {
    throw new Error("APP_PASSWORD env var must be set in production");
  }
  return password;
}
