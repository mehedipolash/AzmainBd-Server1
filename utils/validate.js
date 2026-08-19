/* ---------------------------------------------------------------------------
   Input validation.

   Every write route runs its body through here. Two rules drive the design:

     - Whitelist, never merge. Routes build a new object from known fields
       rather than spreading req.body, so a client cannot smuggle in extra keys
       (role, _id, createdAt) that were never meant to be settable.

     - Coerce and bound. Numbers are parsed and range-checked; strings are
       trimmed and length-capped. Unbounded strings are how you end up with a
       16MB product name.
--------------------------------------------------------------------------- */

const MAX_STRING = 400;
const MAX_TEXT = 4000;
const MAX_PRICE = 100_000_000; // 10 crore BDT — well above any real product
const MAX_STOCK = 1_000_000;

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.statusCode = 400;
  }
}

const asString = (value, field, { required = true, max = MAX_STRING } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ValidationError(`${field} is required`, field);
    return "";
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be text`, field);
  }

  const trimmed = value.trim();

  if (required && trimmed.length === 0) {
    throw new ValidationError(`${field} cannot be blank`, field);
  }

  if (trimmed.length > max) {
    throw new ValidationError(`${field} must be ${max} characters or fewer`, field);
  }

  return trimmed;
};

const asInteger = (value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, required = true } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ValidationError(`${field} is required`, field);
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new ValidationError(`${field} must be a whole number`, field);
  }

  if (parsed < min || parsed > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max}`, field);
  }

  return parsed;
};

const asStringArray = (value, field, { maxItems = 20, maxLength = 60 } = {}) => {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be a list`, field);
  }

  if (value.length > maxItems) {
    throw new ValidationError(`${field} can hold at most ${maxItems} entries`, field);
  }

  return value
    .map((item) => asString(item, field, { max: maxLength }))
    .filter(Boolean);
};

// Only permit image references we are willing to render. Blocking javascript:
// and data: here stops a stored-XSS vector via the product image field.
//
// Two shapes are accepted: an absolute http(s) URL, and the relative path our
// own upload endpoint hands back (/api/images/<id>). The relative form is
// stored verbatim so the same database serves correctly from localhost and
// from the deployed domain without a rewrite.
const UPLOADED_IMAGE_PATH = /^\/api\/images\/[a-f0-9]{24}$/i;

const asImageUrl = (value, field, { required = true } = {}) => {
  const raw = asString(value, field, { required, max: 1000 });
  if (!raw) return "";

  if (UPLOADED_IMAGE_PATH.test(raw)) return raw;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError(`${field} must be a valid URL`, field);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ValidationError(`${field} must be an http or https URL`, field);
  }

  return parsed.toString();
};

// Free-form key/value rows the shop owner adds per product — "Volume: 500ml",
// "Origin: Malaysia". Bounded in count and length like everything else, and
// keys are cleaned so they can never collide with a real document field or
// carry a Mongo operator.
const MAX_CUSTOM_FIELDS = 20;

const asCustomFields = (value, field) => {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be a list`, field);
  }

  if (value.length > MAX_CUSTOM_FIELDS) {
    throw new ValidationError(
      `${field} can hold at most ${MAX_CUSTOM_FIELDS} entries`,
      field,
    );
  }

  return value
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => ({
      // Not required: a half-filled row is dropped by the filter below rather
      // than failing the whole save. The admin form always renders one blank
      // row for the next entry, so blanks are the normal case, not an error.
      //
      // Leading $ and dots are stripped rather than rejected: these are labels
      // typed by a shop owner, not identifiers, so silently cleaning them is
      // friendlier than an error about characters they did not mean to type.
      label: asString(row.label, `${field} label`, { required: false, max: 60 }).replace(
        /^[$]+|[.]/g,
        "",
      ),
      value: asString(row.value, `${field} value`, { required: false, max: 200 }),
    }))
    .filter((row) => row.label && row.value);
};

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

// Builds a clean product document. Note what is absent: no _id, no createdAt
// from the client, no soldCount. Those are server-owned.
const buildProduct = (body, { partial = false } = {}) => {
  const doc = {};
  const need = !partial;

  if (need || body.name !== undefined) doc.name = asString(body.name, "name", { required: need });
  if (need || body.brand !== undefined) doc.brand = asString(body.brand, "brand", { required: need });
  if (need || body.category !== undefined) {
    doc.category = asString(body.category, "category", { required: need });
  }
  if (need || body.description !== undefined) {
    doc.description = asString(body.description, "description", { required: need, max: MAX_TEXT });
  }
  if (need || body.image !== undefined) {
    doc.image = asImageUrl(body.image, "image", { required: need });
  }
  // Price is optional. A null price means "price on request" — the storefront
  // shows a WhatsApp button instead of an amount, which is how the client
  // actually sells the items they have not fixed a price for yet.
  if (need || body.price !== undefined) {
    if (body.price === null || body.price === "") {
      doc.price = null;
    } else {
      doc.price = asInteger(body.price, "price", { min: 1, max: MAX_PRICE, required: false });
    }
  }
  if (body.oldPrice !== undefined && body.oldPrice !== null && body.oldPrice !== "") {
    doc.oldPrice = asInteger(body.oldPrice, "oldPrice", { min: 1, max: MAX_PRICE });

    if (doc.price !== undefined && doc.price !== null && doc.oldPrice <= doc.price) {
      throw new ValidationError("oldPrice must be higher than price", "oldPrice");
    }
  } else if (body.oldPrice === null || body.oldPrice === "") {
    doc.oldPrice = null;
  }
  if (need || body.stock !== undefined) {
    doc.stock = asInteger(body.stock, "stock", { min: 0, max: MAX_STOCK, required: need });
  }
  if (body.specs !== undefined) doc.specs = asStringArray(body.specs, "specs");

  // Variants are simple labels ("500ml", "Charcoal Lavender"). Ordering
  // happens over WhatsApp, so they describe the option rather than driving a
  // separate priced SKU.
  if (body.variants !== undefined) doc.variants = asStringArray(body.variants, "variants");

  if (body.customFields !== undefined) {
    doc.customFields = asCustomFields(body.customFields, "customFields");
  }

  if (Object.keys(doc).length === 0) {
    throw new ValidationError("No valid fields supplied", null);
  }

  return doc;
};

const buildCategory = (body, { partial = false } = {}) => {
  const doc = {};
  const need = !partial;

  if (need || body.name !== undefined) {
    doc.name = asString(body.name, "name", { required: need, max: 80 });
    doc.slug = slugify(body.slug ? asString(body.slug, "slug", { max: 80 }) : doc.name);

    if (!doc.slug) throw new ValidationError("Category name must contain letters or numbers", "name");
  }

  if (need || body.image !== undefined) {
    doc.image = asImageUrl(body.image, "image", { required: need });
  }

  if (Object.keys(doc).length === 0) {
    throw new ValidationError("No valid fields supplied", null);
  }

  return doc;
};

module.exports = {
  ValidationError,
  asString,
  asInteger,
  asStringArray,
  asImageUrl,
  asCustomFields,
  slugify,
  buildProduct,
  buildCategory,
};
