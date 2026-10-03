// Shared pagination helper for list endpoints.
//
// Usage:
//   const { page, limit, skip } = parsePagination(req.query);
//   const [items, total] = await Promise.all([
//     prisma.model.findMany({ where, orderBy, skip, take: limit }),
//     prisma.model.count({ where }),
//   ]);
//   res.json({ items, pagination: buildMeta(page, limit, total) });
//
// Kept deliberately dependency-free (no extra package) since it's a handful
// of lines of pure math — a library would be overkill.

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(query = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
}

function buildMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

module.exports = { parsePagination, buildMeta, DEFAULT_LIMIT, MAX_LIMIT };
