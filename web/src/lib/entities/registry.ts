import type { EntityConfig } from "./types";

// Auto-discovery of every defs/*.ts module — mirrors the CLI's proven
// apollo_cli/entities/ auto-discovery pattern (Phase 3). Adding an entity is
// adding a file under defs/, never editing a hand-maintained list here.
const modules = import.meta.glob("./defs/*.ts", { eager: true }) as Record<
  string,
  { default?: unknown }
>;

function isEntityConfig(value: unknown): value is EntityConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "etype" in value &&
    typeof (value as { etype: unknown }).etype === "string" &&
    (value as { etype: string }).etype.length > 0
  );
}

const configs: EntityConfig[] = Object.entries(modules).map(([path, mod]) => {
  const candidate = mod.default;
  if (!isEntityConfig(candidate)) {
    throw new Error(
      `web/src/lib/entities/registry.ts: ${path} must default-export a valid EntityConfig with a non-empty "etype"`,
    );
  }
  return candidate;
});

configs.sort((a, b) => a.ordem - b.ordem);

export const entityConfigs: EntityConfig[] = configs;

export function configByEtype(etype: string): EntityConfig | undefined {
  return entityConfigs.find((config) => config.etype === etype);
}
