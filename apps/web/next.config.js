const fs = require("node:fs");
const path = require("node:path");
const { loadEnvConfig } = require("@next/env");

const repoRoot = path.join(__dirname, "../..");

/** Стандартная загрузка `.env*` из корня монорепозитория */
const { combinedEnv } = loadEnvConfig(repoRoot);

/**
 * Fallback: иногда `combinedEnv` не содержит ключ, пока Next ещё не смержил слои —
 * читаем корневой `.env.local` вручную (одна строка = KEY=VALUE).
 */
function readRootEnvLocal() {
  const file = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(file)) {
    return {};
  }
  const out = {};
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const manual = readRootEnvLocal();
const yandexKey =
  combinedEnv.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ||
  manual.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ||
  "";

if (yandexKey) {
  process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY = yandexKey;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "../../"),
  /**
   * Явно прокидываем в клиентский бандл (DefinePlugin), чтобы ключ не терялся между слоями env.
   */
  env: {
    NEXT_PUBLIC_YANDEX_MAPS_API_KEY: yandexKey,
  },
};

module.exports = nextConfig;
