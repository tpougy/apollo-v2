// Schema-driven screen-coverage gate. Mirrors cli/tests/test_cli_surface.py's
// three-part contract exactly: (1) a formatting-locked regex extracts the
// entity list from shared/instant.schema.ts directly — never a hand-maintained
// list — with a loud `>= 9` self-check so a schema reformat that breaks the
// regex fails immediately instead of silently matching zero entities; (2) a
// single EXPECTED_CAPABILITIES map pins the capability/updatableFields
// invariants per entity, mirroring EXPECTED_SURFACE; (3) structural
// assertions (unique `ordem`, no "dono"-named field, listColumns/link/xor
// target integrity) that catch typos and drift without a human having to
// remember to update a checklist.
//
// Runs headlessly under `bun test` — no DOM, no network, no Svelte import.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { EntityConfig, LinkDef } from "./types";

// registry.ts uses Vite's `import.meta.glob(...)` for eager auto-discovery,
// a build-time macro that only exists under Vite's transform pipeline — it
// is not a real runtime API and is `undefined` under `bun test` (bun runs
// this file directly, with no Vite transform in front of it). Importing
// registry.ts from this module would therefore throw immediately at import
// time, before a single assertion ran. This test re-implements the exact
// same "eager-glob" contract by hand: `readdirSync` the same `defs/`
// directory registry.ts globs, dynamically `import()` each module (the same
// real EntityConfig objects registry.ts would load), and validate/sort them
// identically to registry.ts's own `isEntityConfig`/sort-by-`ordem` logic.
// This is a coverage test over the SAME SOURCE FILES `defs/*.ts`, not a
// reimplementation of different behavior — a missing or malformed defs file
// fails this test exactly as it would fail the real app at runtime.
function isEntityConfig(value: unknown): value is EntityConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "etype" in value &&
    typeof (value as { etype: unknown }).etype === "string" &&
    (value as { etype: string }).etype.length > 0
  );
}

const defsDir = fileURLToPath(new URL("./defs/", import.meta.url));
const defsFiles = readdirSync(defsDir).filter((f) => f.endsWith(".ts"));
const loadedConfigs: EntityConfig[] = await Promise.all(
  defsFiles.map(async (file) => {
    const mod = (await import(`./defs/${file}`)) as { default?: unknown };
    if (!isEntityConfig(mod.default)) {
      throw new Error(
        `defs/${file} must default-export a valid EntityConfig with a non-empty "etype"`,
      );
    }
    return mod.default;
  }),
);
loadedConfigs.sort((a, b) => a.ordem - b.ordem);

const entityConfigs: readonly EntityConfig[] = loadedConfigs;

function configByEtype(etype: string): EntityConfig | undefined {
  return entityConfigs.find((config) => config.etype === etype);
}

// Matches the schema's own formatting exactly: four-space-indented entity
// keys immediately followed by `i.entity(` (see shared/instant.schema.ts).
// A formatting change to the schema file must break this regex loudly (the
// `length >= 9` assertion below), never silently match zero entities — this
// is the exact self-check cli/tests/test_cli_surface.py established in
// Phase 3, mirrored here verbatim in intent.
const ENTITY_RE = /^ {4}(\w+): i\.entity\(/gm;

function schemaEntityNames(): string[] {
  const schemaPath = fileURLToPath(
    new URL("../../../../shared/instant.schema.ts", import.meta.url),
  );
  const text = readFileSync(schemaPath, "utf-8");
  const names = Array.from(text.matchAll(ENTITY_RE), (m) => m[1] as string);
  expect(
    names.length,
    `expected >= 9 entities in ${schemaPath} matching ${ENTITY_RE.source}, ` +
      `found ${names.length}: ${JSON.stringify(names)} -- the schema's formatting may have changed`,
  ).toBeGreaterThanOrEqual(9);
  return names;
}

const SCHEMA_ENTITY_NAMES = schemaEntityNames();

interface ExpectedCapabilities {
  create: boolean;
  update: boolean;
  delete: boolean;
  updatableFields?: readonly string[];
}

// entity name -> expected capability triple (+ optional updatableFields
// narrowing), mirroring the CLI test's EXPECTED_SURFACE. Every entity found
// in the schema MUST appear here — a new entity landing with no entry fails
// test_schema_entity_has_screen below, naming the missing entity.
const EXPECTED_CAPABILITIES: Record<string, ExpectedCapabilities> = {
  fundos: { create: true, update: true, delete: true },
  projetos: { create: true, update: true, delete: true },
  etapas: { create: true, update: true, delete: true },
  tarefas: { create: true, update: true, delete: true },
  templatesRotina: { create: true, update: true, delete: true },
  instanciasRotina: { create: false, update: true, delete: false, updatableFields: ["status"] },
  tickets: { create: true, update: true, delete: true },
  subtarefas: { create: true, update: true, delete: true },
  logInferenciaClaude: { create: false, update: false, delete: false },
};

describe("registry coverage: every schema entity has a screen", () => {
  for (const entityName of SCHEMA_ENTITY_NAMES) {
    test(`${entityName}: has a defs/*.ts config with etype === "${entityName}"`, () => {
      const config = configByEtype(entityName);
      expect(
        config,
        `no defs/*.ts module found for schema entity ${JSON.stringify(entityName)}`,
      ).toBeDefined();
      expect(
        (config as EntityConfig).etype,
        `configByEtype(${entityName}) returned a config whose etype does not match`,
      ).toBe(entityName);
    });

    test(`${entityName}: has an EXPECTED_CAPABILITIES entry`, () => {
      expect(
        EXPECTED_CAPABILITIES[entityName],
        `schema entity ${entityName} has no EXPECTED_CAPABILITIES mapping -- ` +
          "a new entity must never ship without a pinned capability expectation",
      ).toBeDefined();
    });
  }

  test("EXPECTED_CAPABILITIES has no stale entries (catches renames/drops)", () => {
    const schemaSet = new Set(SCHEMA_ENTITY_NAMES);
    const stale = Object.keys(EXPECTED_CAPABILITIES).filter((name) => !schemaSet.has(name));
    expect(stale, `EXPECTED_CAPABILITIES has entries not in the schema: ${stale}`).toEqual([]);
  });
});

describe("registry coverage: capability invariants per entity", () => {
  for (const [entityName, expected] of Object.entries(EXPECTED_CAPABILITIES)) {
    test(`${entityName}: capabilities match {create:${expected.create}, update:${expected.update}, delete:${expected.delete}}`, () => {
      const config = configByEtype(entityName);
      expect(config, `${entityName}: no config found`).toBeDefined();
      const c = (config as EntityConfig).capabilities;
      expect(c.create, `${entityName}: capabilities.create expected ${expected.create}`).toBe(
        expected.create,
      );
      expect(c.update, `${entityName}: capabilities.update expected ${expected.update}`).toBe(
        expected.update,
      );
      expect(c.delete, `${entityName}: capabilities.delete expected ${expected.delete}`).toBe(
        expected.delete,
      );
    });

    if (expected.updatableFields !== undefined) {
      test(`${entityName}: updatableFields equals ${JSON.stringify(expected.updatableFields)}`, () => {
        const config = configByEtype(entityName) as EntityConfig;
        expect(
          config.updatableFields,
          `${entityName}: updatableFields expected ${JSON.stringify(expected.updatableFields)}`,
        ).toEqual(expected.updatableFields as string[]);
      });
    }
  }

  test("instanciasRotina: create and delete are both false (C-06 invariant)", () => {
    const config = configByEtype("instanciasRotina") as EntityConfig;
    expect(config.capabilities.create, "instanciasRotina.capabilities.create must be false").toBe(
      false,
    );
    expect(config.capabilities.delete, "instanciasRotina.capabilities.delete must be false").toBe(
      false,
    );
    expect(
      config.updatableFields,
      'instanciasRotina.updatableFields must equal exactly ["status"]',
    ).toEqual(["status"]);
  });

  test("logInferenciaClaude: all three capabilities are false (append-only invariant)", () => {
    const config = configByEtype("logInferenciaClaude") as EntityConfig;
    expect(
      config.capabilities.create,
      "logInferenciaClaude.capabilities.create must be false",
    ).toBe(false);
    expect(
      config.capabilities.update,
      "logInferenciaClaude.capabilities.update must be false",
    ).toBe(false);
    expect(
      config.capabilities.delete,
      "logInferenciaClaude.capabilities.delete must be false",
    ).toBe(false);
  });

  test("the other seven entities have all three capabilities true", () => {
    const restricted = new Set(["instanciasRotina", "logInferenciaClaude"]);
    const fullCrud = Object.keys(EXPECTED_CAPABILITIES).filter((name) => !restricted.has(name));
    expect(fullCrud.length, "expected exactly 7 full-CRUD entities").toBe(7);
    for (const entityName of fullCrud) {
      const config = configByEtype(entityName) as EntityConfig;
      expect(config.capabilities, `${entityName}: expected all capabilities true`).toEqual({
        create: true,
        update: true,
        delete: true,
      });
    }
  });
});

describe("registry structural integrity", () => {
  test("every config's listColumns are non-empty and name a real field, link label, or xorLink choice label", () => {
    for (const config of entityConfigs) {
      expect(
        config.listColumns.length,
        `${config.etype}: listColumns must be non-empty`,
      ).toBeGreaterThan(0);
      const fieldNames = new Set(config.fields.map((f) => f.name));
      const linkLabels = new Set((config.links ?? []).map((l) => l.label));
      const xorLabels = new Set(
        config.xorLink ? config.xorLink.choices.map((choice) => choice.label) : [],
      );
      for (const column of config.listColumns) {
        const known = fieldNames.has(column) || linkLabels.has(column) || xorLabels.has(column);
        expect(
          known,
          `${config.etype}: listColumns entry ${JSON.stringify(column)} names no declared field, ` +
            "link label, or xorLink choice label",
        ).toBe(true);
      }
    }
  });

  test("every config's ordem is unique across the registry", () => {
    const seen = new Map<number, string>();
    for (const config of entityConfigs) {
      const prior = seen.get(config.ordem);
      expect(
        prior,
        `${config.etype}: ordem ${config.ordem} collides with ${prior} -- nav order is ambiguous`,
      ).toBeUndefined();
      seen.set(config.ordem, config.etype);
    }
  });

  test('no config declares a field whose name contains "dono" (case-insensitive)', () => {
    for (const config of entityConfigs) {
      for (const field of config.fields) {
        expect(
          field.name.toLowerCase().includes("dono"),
          `${config.etype}: field ${JSON.stringify(field.name)} contains "dono" -- owner-id must ` +
            "never be expressible as a FieldDef",
        ).toBe(false);
      }
    }
  });

  test('templatesRotina: has a non-required "number" field named offsetDias, listed in listColumns', () => {
    const config = configByEtype("templatesRotina") as EntityConfig;
    const field = config.fields.find((f) => f.name === "offsetDias");
    expect(field, "templatesRotina: no field named offsetDias").toBeDefined();
    expect(field?.kind, "templatesRotina.offsetDias: expected kind 'number'").toBe("number");
    expect(field?.required, "templatesRotina.offsetDias: expected required === false").toBe(
      false,
    );
    expect(
      config.listColumns.includes("offsetDias"),
      "templatesRotina.listColumns: expected to include 'offsetDias'",
    ).toBe(true);
  });

  test("every LinkDef.targetEtype and every XorLinkDef choice target resolves to a real schema entity", () => {
    const schemaSet = new Set(SCHEMA_ENTITY_NAMES);
    function checkLink(etype: string, link: LinkDef) {
      expect(
        schemaSet.has(link.targetEtype),
        `${etype}: link ${JSON.stringify(link.label)} targets unknown entity ${JSON.stringify(link.targetEtype)}`,
      ).toBe(true);
    }
    for (const config of entityConfigs) {
      for (const link of config.links ?? []) {
        checkLink(config.etype, link);
      }
      if (config.xorLink) {
        for (const choice of config.xorLink.choices) {
          checkLink(config.etype, choice);
        }
      }
    }
  });
});
