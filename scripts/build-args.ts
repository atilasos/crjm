/** CLI values stay untrusted until Bun.build validates its configuration. */
const toCamelCase = (str: string): string => str.replace(/-([a-z])/g, g => g.charAt(1).toUpperCase());

const parseValue = (value: string): unknown => {
  if (value === "true") return true;
  if (value === "false") return false;

  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d*\.\d+$/.test(value)) return parseFloat(value);

  if (value.includes(",")) return value.split(",").map(v => v.trim());

  return value;
};

export function parseBuildArgs(args: readonly string[]): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (!arg.startsWith("--")) continue;

    if (arg.startsWith("--no-")) {
      const key = toCamelCase(arg.slice(5));
      config[key] = false;
      continue;
    }

    if (!arg.includes("=") && (i === args.length - 1 || args[i + 1]?.startsWith("--"))) {
      const key = toCamelCase(arg.slice(2));
      config[key] = true;
      continue;
    }

    let key: string;
    let value: string;

    if (arg.includes("=")) {
      [key = "", value = ""] = arg.slice(2).split("=", 2);
    } else {
      key = arg.slice(2);
      value = args[++i] ?? "";
    }

    key = toCamelCase(key);

    if (key.includes(".")) {
      const [parentKey = "", childKey = ""] = key.split(".");
      const parent = config[parentKey] || {};
      if (typeof parent !== "object" || parent === null) {
        throw new TypeError(`Build option ${parentKey} cannot hold nested options`);
      }
      config[parentKey] = parent;
      Object.defineProperty(parent, childKey, {
        value: parseValue(value), writable: true, enumerable: true, configurable: true,
      });
    } else {
      config[key] = parseValue(value);
    }
  }

  return config;
}
