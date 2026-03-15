// Bundle manifest parser - validates and parses bundle JSON from source repos
// Spec refs: Section 7.7 (Bundle Manifest), Section 7.8 (BundleItem), US-07
// WP09 T09-01

import type { Bundle, BundleItem } from '../models/types';

const VALID_TOOLS = ['copilot', 'claude-code'];
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Parse and validate a bundle manifest JSON string.
 * Returns a validated Bundle object or throws with a descriptive error.
 */
export function parseBundle(content: string, bundleName?: string): Bundle {
  const label = bundleName ? `bundle '${bundleName}'` : 'bundle';

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in ${label}: unable to parse`);
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`Invalid ${label}: expected a JSON object`);
  }

  const obj = raw as Record<string, unknown>;

  // Validate name
  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    throw new Error(`Invalid ${label}: 'name' is required and must be a non-empty string`);
  }
  if (obj.name.length > MAX_NAME_LENGTH) {
    throw new Error(`Invalid ${label}: 'name' must be at most ${MAX_NAME_LENGTH} characters`);
  }

  // Validate description (optional)
  if (obj.description !== undefined && obj.description !== null) {
    if (typeof obj.description !== 'string') {
      throw new Error(`Invalid ${label}: 'description' must be a string`);
    }
    if (obj.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(`Invalid ${label}: 'description' must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
    }
  }

  // Validate items
  if (!Array.isArray(obj.items)) {
    throw new Error(`Invalid ${label}: 'items' is required and must be an array`);
  }
  if (obj.items.length === 0) {
    throw new Error(`Invalid ${label}: 'items' must contain at least one item`);
  }

  const items: BundleItem[] = [];
  for (let i = 0; i < obj.items.length; i++) {
    items.push(parseBundleItem(obj.items[i], i, label));
  }

  return {
    name: obj.name,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    items,
  };
}

function parseBundleItem(raw: unknown, index: number, label: string): BundleItem {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`Invalid ${label}, item[${index}]: expected an object`);
  }

  const obj = raw as Record<string, unknown>;

  // path (required)
  if (typeof obj.path !== 'string' || obj.path.length === 0) {
    throw new Error(`Invalid ${label}, item[${index}]: 'path' is required and must be a non-empty string`);
  }

  // tool (required, enum)
  if (typeof obj.tool !== 'string' || !VALID_TOOLS.includes(obj.tool)) {
    throw new Error(
      `Invalid ${label}, item[${index}]: 'tool' is required and must be one of: ${VALID_TOOLS.join(', ')}`,
    );
  }

  // category (required)
  if (typeof obj.category !== 'string' || obj.category.length === 0) {
    throw new Error(`Invalid ${label}, item[${index}]: 'category' is required and must be a non-empty string`);
  }

  // sourceUrl (optional)
  if (obj.sourceUrl !== undefined && obj.sourceUrl !== null) {
    if (typeof obj.sourceUrl !== 'string' || obj.sourceUrl.length === 0) {
      throw new Error(`Invalid ${label}, item[${index}]: 'sourceUrl' must be a non-empty string`);
    }
  }

  // required (optional, default true)
  let required = true;
  if (obj.required !== undefined && obj.required !== null) {
    if (typeof obj.required !== 'boolean') {
      throw new Error(`Invalid ${label}, item[${index}]: 'required' must be a boolean`);
    }
    required = obj.required;
  }

  return {
    path: obj.path,
    tool: obj.tool as 'copilot' | 'claude-code',
    category: obj.category,
    sourceUrl: typeof obj.sourceUrl === 'string' ? obj.sourceUrl : undefined,
    required,
  };
}
