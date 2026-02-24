// ============================================================
//  Dynamic Random Data Generator for MongoDB Collections
//  Pass - Any eg document schema, get back realistic random data 
//  Usage: generateRandom(schema, count, customGenerators)
// ============================================================

// ─────────────────────────────────────────
//  BUILT-IN NAMED FIELD GENERATORS
//  These fire when a field NAME matches
// ─────────────────────────────────────────
const namedGenerators = {
  // IDs & Auth
  authorId: () => Math.floor(Math.random() * 1e18).toString(),
  _id: () => randomMongoId(),
  __v: () => 0,

  // Names & Text
  authorName: () => randomFullName(),
  title: () => randomSentence(3, 6),
  details: () => randomSentence(8, 20),
  description: () => randomSentence(10, 25),
  message: () => randomSentence(5, 15),
  name: () => randomFullName(),
  firstName: () => randomFirstName(),
  lastName: () => randomLastName(),
  username: () => randomUsername(),
  slug: () => randomSlug(),
  bio: () => randomSentence(10, 20),

  // Category / Status / Type
  category: () => randomPick(["Feature Request", "Bug", "Improvement", "Question", "Discussion", "Feedback"]),
  status: () => randomPick(["active", "inactive", "pending", "approved", "rejected"]),
  role: () => randomPick(["admin", "user", "moderator", "guest"]),
  type: () => randomPick(["basic", "premium", "enterprise"]),
  priority: () => randomPick(["low", "medium", "high", "critical"]),
  tag: () => randomPick(["javascript", "react", "nodejs", "mongodb", "css", "api"]),
  tags: () => Array.from({ length: randomInt(1, 4) }, () => randomPick(["javascript", "react", "nodejs", "mongodb", "css"])),

  // Counts & Numbers
  upvotes: () => randomInt(0, 500),
  downvotes: () => randomInt(0, 100),
  views: () => randomInt(0, 10000),
  likes: () => randomInt(0, 1000),
  count: () => randomInt(1, 100),
  score: () => parseFloat((Math.random() * 10).toFixed(2)),
  rating: () => parseFloat((Math.random() * 5).toFixed(1)),
  age: () => randomInt(18, 80),
  price: () => parseFloat((Math.random() * 1000).toFixed(2)),

  // Arrays
  votes: () => [],
  comments: () => [],
  images: () => [],
  items: () => [],

  // URLs & Images
  authorImageUrl: () => `https://i.pravatar.cc/96?u=${randomInt(1, 1000)}`,
  imageUrl: () => `https://picsum.photos/seed/${randomInt(1, 1000)}/400/300`,
  avatar: () => `https://i.pravatar.cc/96?u=${randomInt(1, 1000)}`,
  url: () => `https://example.com/${randomSlug()}`,
  website: () => `https://www.${randomSlug()}.com`,

  // Contact
  email: () => `${randomUsername()}@${randomPick(["gmail.com", "yahoo.com", "outlook.com", "mail.com"])}`,
  phone: () => `+1${randomInt(1000000000, 9999999999)}`,

  // Dates
  createdAt: () => ({ $date: randomDate(new Date("2023-01-01"), new Date()).toISOString() }),
  updatedAt: () => ({ $date: randomDate(new Date("2023-01-01"), new Date()).toISOString() }),
  dob: () => randomDate(new Date("1970-01-01"), new Date("2005-12-31")).toISOString().split("T")[0],
  publishedAt: () => randomDate(new Date("2022-01-01"), new Date()).toISOString(),

  // Boolean flags
  isActive: () => randomBool(),
  isVerified: () => randomBool(),
  isPublic: () => randomBool(),
  isPremium: () => randomBool(),
};

// ─────────────────────────────────────────
//  TYPE-BASED FALLBACK GENERATORS
//  These fire when field name has no match
// ─────────────────────────────────────────
const typeGenerators = {
  string: () => randomSentence(2, 5),
  number: () => randomInt(0, 1000),
  boolean: () => randomBool(),
  array: () => [],
  object: (schema) => generateRandom(schema, 1)[0],  // Recurse for nested objects
};

// ─────────────────────────────────────────
//  CORE GENERATOR FUNCTION
// ─────────────────────────────────────────

/**
 * Generate random documents from a schema
 * @param {Object} schema      - Your MongoDB document sample / schema
 * @param {number} count       - How many documents to generate (default: 1)
 * @param {Object} custom      - Override or add named generators { fieldName: () => value }
 * @returns {Array}            - Array of generated documents
 */
function generateRandom(schema, count = 1, custom = {}) {
  // Merge custom generators on top of built-ins
  const generators = { ...namedGenerators, ...custom };

  return Array.from({ length: count }, () => generateDocument(schema, generators));
}

function generateDocument(schema, generators) {
  const doc = {};

  for (const [key, value] of Object.entries(schema)) {
    doc[key] = generateField(key, value, generators);
  }

  return doc;
}

function generateField(key, value, generators) {
  // 1. Check if there's a named generator (exact match, case-insensitive)
  const lowerKey = key.toLowerCase();
  const matchedKey = Object.keys(generators).find(k => k.toLowerCase() === lowerKey);
  if (matchedKey) {
    return generators[matchedKey]();
  }

  // 2. Check partial name matches (e.g. "userEmail" matches "email")
  const partialKey = Object.keys(generators).find(k => lowerKey.includes(k.toLowerCase()));
  if (partialKey) {
    return generators[partialKey]();
  }

  // 3. Fall back to type-based generation
  return generateByType(key, value, generators);
}

function generateByType(key, value, generators) {
  // Handle nested { $date: "..." } — MongoDB date format
  if (value && typeof value === "object" && "$date" in value) {
    return { $date: randomDate(new Date("2023-01-01"), new Date()).toISOString() };
  }

  // Null / undefined → random string
  if (value === null || value === undefined) {
    return null;
  }

  const type = typeof value;

  switch (type) {
    case "string":
      return typeGenerators.string();

    case "number":
      // If original is an integer, keep it integer
      return Number.isInteger(value) ? randomInt(0, 1000) : parseFloat((Math.random() * 1000).toFixed(2));

    case "boolean":
      return typeGenerators.boolean();

    case "object":
      if (Array.isArray(value)) {
        return typeGenerators.array();
      }
      // Nested object — recurse
      if (Object.keys(value).length > 0) {
        return generateDocument(value, generators);
      }
      return {};

    default:
      return null;
  }
}

// ─────────────────────────────────────────
//  HELPER / UTILITY FUNCTIONS
// ─────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBool() {
  return Math.random() > 0.5;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomMongoId() {
  return [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
}

function randomFirstName() {
  const names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry", "Iris", "Jack",
    "Karan", "Luna", "Mike", "Nina", "Oscar", "Priya", "Quinn", "Riya", "Sam", "Tina"];
  return randomPick(names);
}

function randomLastName() {
  const names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Wilson", "Taylor", "Anderson", "Thomas", "Kumar", "Sharma", "Patel"];
  return randomPick(names);
}

function randomFullName() {
  return `${randomFirstName()} ${randomLastName()}`;
}

function randomUsername() {
  return `${randomFirstName().toLowerCase()}${randomInt(10, 999)}`;
}

function randomSlug() {
  const words = ["quick", "lazy", "smart", "bold", "dark", "light", "fast", "cool", "fresh", "wild"];
  return `${randomPick(words)}-${randomPick(words)}-${randomInt(10, 99)}`;
}

function randomSentence(minWords = 5, maxWords = 12) {
  const words = ["the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog",
    "hello", "world", "test", "sample", "data", "random", "value", "generate",
    "dynamic", "content", "lorem", "ipsum", "mock", "dummy", "example", "default"];
  const length = randomInt(minWords, maxWords);
  const sentence = Array.from({ length }, () => randomPick(words)).join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// ─────────────────────────────────────────
//  EXAMPLE: Your Suggestion Collection
// ─────────────────────────────────────────

const suggestionSchema = {
  title: "dfasdfsdfasdf",
  category: "Feature Request",
  details: "sdfsdfasf",
  authorId: "110337487793063822152",
  authorName: "RAar",
  authorImageUrl: "https://lh3.googleusercontent.com/a/sample",
  upvotes: 0,
  votes: [],
  comments: [],
  createdAt: { $date: "2026-02-07T09:33:13.082Z" },
  updatedAt: { $date: "2026-02-07T09:33:13.082Z" },
  __v: 0,
};

// ─────────────────────────────────────────
//  EXAMPLE: Custom Generators Override
// ─────────────────────────────────────────

const customGenerators = {
  // Override specific fields with your own logic
  title: () => randomPick([
    "Add dark mode support",
    "Fix login bug on mobile",
    "Improve search performance",
    "Add export to PDF feature",
    "Better error messages needed",
  ]),
  upvotes: () => randomInt(0, 250),
};

// ─────────────────────────────────────────
//  RUN & OUTPUT
// ─────────────────────────────────────────

const generatedDocs = generateRandom(suggestionSchema, 5, customGenerators);

console.log("=== Generated Suggestion Documents ===\n");
console.log(JSON.stringify(generatedDocs, null, 2));

// ─────────────────────────────────────────
//  EXPORT (for use in other files)
// ─────────────────────────────────────────

// If using CommonJS (Node.js)
// module.exports = { generateRandom, namedGenerators, typeGenerators };

// If using ES Modules
// export { generateRandom, namedGenerators, typeGenerators };