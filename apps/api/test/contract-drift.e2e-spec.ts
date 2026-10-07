import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  gradeKeySchema,
  gradeViewSchema,
  loginInputSchema,
  meSchema,
  eventFormatSchema,
  eventInputSchema,
  matchFormatSchema,
  registerInputSchema,
  tournamentInputSchema,
  roleSchema,
  userSummarySchema,
} from '@blulens/shared';

/**
 * Contract drift (bl-10 wave 1): every zod schema in @blulens/shared that mirrors an openapi component must
 * have the same property names, the same required set and the same enum values. Add a row to PAIRS whenever a
 * new shared schema mirrors an openapi component.
 */

type OaSchema = {
  type?: string | string[];
  properties?: Record<string, unknown>;
  required?: string[];
  enum?: string[];
  allOf?: OaSchema[];
  $ref?: string;
};

const spec = parse(readFileSync(resolve(__dirname, '../../../docs/api/openapi.yaml'), 'utf8')) as {
  components: { schemas: Record<string, OaSchema> };
};

function component(name: string): OaSchema {
  const s = spec.components.schemas[name];
  if (!s) throw new Error(`openapi has no components.schemas.${name}`);
  return s;
}

/** Flattens allOf + $ref into one object schema (properties + required). */
function flatten(s: OaSchema): { properties: string[]; required: string[] } {
  if (s.$ref) return flatten(component(s.$ref.split('/').pop()!));
  if (s.allOf) {
    const parts = s.allOf.map(flatten);
    return {
      properties: [...new Set(parts.flatMap((p) => p.properties))].sort(),
      required: [...new Set(parts.flatMap((p) => p.required))].sort(),
    };
  }
  // readOnly properties are server-set (e.g. EventFormat.lockedAt) and never part of an input schema
  const props = Object.entries(s.properties ?? {}).filter(([, v]) => !(v as { readOnly?: boolean }).readOnly);
  return { properties: props.map(([k]) => k).sort(), required: [...(s.required ?? [])].sort() };
}

function zodObject(schema: z.ZodTypeAny): { properties: string[]; required: string[] } {
  // unwrap .refine()/.superRefine() (ZodEffects) to the underlying object
  let obj: z.ZodTypeAny = schema;
  while (!('shape' in obj)) obj = (obj._def as { schema: z.ZodTypeAny }).schema; // chained .refine() nests ZodEffects
  const shape = (obj as z.AnyZodObject).shape as Record<string, z.ZodTypeAny>;
  return {
    properties: Object.keys(shape).sort(),
    required: Object.keys(shape)
      .filter((k) => !shape[k]!.isOptional())
      .sort(),
  };
}

const OBJECT_PAIRS: [string, z.ZodTypeAny][] = [
  ['RegisterInput', registerInputSchema],
  ['LoginInput', loginInputSchema],
  ['UserSummary', userSummarySchema],
  ['Me', meSchema],
  ['GradeView', gradeViewSchema],
  ['TournamentInput', tournamentInputSchema],
  ['EventInput', eventInputSchema],
  ['EventFormat', eventFormatSchema],
  ['MatchFormat', matchFormatSchema],
];

const ENUM_PAIRS: [string, z.ZodEnum<[string, ...string[]]>][] = [
  ['Role', roleSchema],
  ['GradeKey', gradeKeySchema],
];

describe('contract drift: @blulens/shared zod vs docs/api/openapi.yaml', () => {
  it.each(OBJECT_PAIRS)('%s has the same properties and required set', (name, schema) => {
    expect(zodObject(schema)).toEqual(flatten(component(name)));
  });

  it.each(ENUM_PAIRS)('%s has the same enum values in the same order', (name, schema) => {
    expect(schema.options).toEqual(component(name).enum);
  });
});
