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

// Only permit image URLs we are willing to render. Blocking javascript: and
// data: here stops a stored-XSS vector via the product image field.
const asImageUrl = (value, field, { required = true } = {}) => {
  const raw = asString(value, field, { required, max: 1000 });
  if (!raw) return "";

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
  if (need || body.price !== undefined) {
    doc.price = asInteger(body.price, "price", { min: 1, max: MAX_PRICE, required: need });
  }
  if (body.oldPrice !== undefined && body.oldPrice !== null && body.oldPrice !== "") {
    doc.oldPrice = asInteger(body.oldPrice, "oldPrice", { min: 1, max: MAX_PRICE });

    if (doc.price !== undefined && doc.oldPrice <= doc.price) {
      throw new ValidationError("oldPrice must be higher than price", "oldPrice");
    }
  } else if (body.oldPrice === null || body.oldPrice === "") {
    doc.oldPrice = null;
  }
  if (need || body.stock !== undefined) {
    doc.stock = asInteger(body.stock, "stock", { min: 0, max: MAX_STOCK, required: need });
  }
  if (body.specs !== undefined) doc.specs = asStringArray(body.specs, "specs");

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
  slugify,
  buildProduct,
  buildCategory,
};
