// SPDX-License-Identifier: GPL-3.0-only
// Validates a value against the JSON Schema subset the row/payload schemas use (type, const, enum,
// minimum, maximum, minLength, maxLength, pattern, required, additionalProperties: false,
// properties). No third-party validator: keeps contracts dependency-free. Unknown keywords that
// constrain values make it throw, so a schema can't silently outgrow this checker.

const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', 'default']);
const KNOWN = new Set([
  ...ANNOTATIONS,
  'type', 'const', 'enum', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern',
  'required', 'additionalProperties', 'properties', 'items', '$ref',
]);

const typeOf = (v) =>
  v === null ? 'null' : Number.isInteger(v) ? 'integer' : Array.isArray(v) ? 'array' : typeof v;

/** Returns a list of human-readable errors (empty = valid). `$ref`s resolve through `refs`. */
export function validate(schema, value, { refs = {}, path = '$' } = {}) {
  const errors = [];
  for (const k of Object.keys(schema)) {
    if (!KNOWN.has(k) && !k.startsWith('x-')) throw new Error(`row-schema: unsupported keyword ${k} at ${path}`);
  }
  if (schema.$ref) {
    const target = refs[schema.$ref];
    if (!target) throw new Error(`row-schema: unresolved $ref ${schema.$ref}`);
    return validate(target, value, { refs, path });
  }
  const t = typeOf(value);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = types.some((x) => x === t || (x === 'number' && t === 'integer'));
    if (!ok) return [`${path}: ${t} is not ${types.join('|')}`];
  }
  if ('const' in schema && value !== schema.const) errors.push(`${path}: not ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} not in enum`);
  if (t === 'integer') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: < ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: > ${schema.maximum}`);
  }
  if (t === 'string') {
    const len = [...value].length; // JSON Schema counts code points, like SQLite length()
    if (schema.minLength !== undefined && len < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && len > schema.maxLength) errors.push(`${path}: longer than ${schema.maxLength}`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) {
      errors.push(`${path}: does not match ${schema.pattern}`);
    }
  }
  if (t === 'object') {
    for (const r of schema.required ?? []) if (!Object.hasOwn(value, r)) errors.push(`${path}: missing ${r}`);
    for (const [k, v] of Object.entries(value)) {
      const sub = schema.properties && Object.hasOwn(schema.properties, k) ? schema.properties[k] : undefined;
      if (sub) errors.push(...validate(sub, v, { refs, path: `${path}.${k}` }));
      else if (schema.additionalProperties === false) errors.push(`${path}: unexpected ${k}`);
    }
  }
  if (t === 'array' && schema.items) {
    value.forEach((v, i) => errors.push(...validate(schema.items, v, { refs, path: `${path}[${i}]` })));
  }
  return errors;
}
