const db = require('../models');
const auditService = require('../services/auditService');

// Phase 4.5 C21 follow-up — query-param parser. Default behaviour hides
// archived rows; pass ?includeArchived=true to see them (used by the
// admin "Show archived" toggle on the Product Taxonomy page).
const shouldIncludeArchived = (req) => String(req.query.includeArchived || '').toLowerCase() === 'true';
const archivedWhere = (req) => (shouldIncludeArchived(req) ? {} : { isArchived: false });

// ─── Sovern House default taxonomy ────────────────────────────────────────────
// No Logs category (dropped per 2026-04-21 decision)
const SOVERN_HOUSE_TEMPLATE = [
  {
    name: 'Flooring',
    slug: 'flooring',
    icon: '🪵',
    description: 'Hard and soft floor coverings sourced from Asia',
    sortOrder: 1,
    children: [
      { name: 'Laminate', slug: 'laminate', sortOrder: 1 },
      { name: 'Engineered Wood', slug: 'engineered-wood', sortOrder: 2 },
      { name: 'SPC (Stone Plastic Composite)', slug: 'spc', sortOrder: 3 },
      { name: 'LVT (Luxury Vinyl Tile)', slug: 'lvt', sortOrder: 4 },
      { name: 'WPC (Wood Plastic Composite)', slug: 'wpc', sortOrder: 5 },
      { name: 'Solid Hardwood', slug: 'solid-hardwood', sortOrder: 6 },
      { name: 'Porcelain Tile', slug: 'porcelain-tile', sortOrder: 7 },
      { name: 'Ceramic Tile', slug: 'ceramic-tile', sortOrder: 8 },
      { name: 'Vinyl Sheet', slug: 'vinyl-sheet', sortOrder: 9 },
      { name: 'Bamboo', slug: 'bamboo', sortOrder: 10 },
    ],
  },
  {
    name: 'Garments & Fabrics',
    slug: 'garments-fabrics',
    icon: '👕',
    description: 'Apparel and textile products for retail and private label buyers',
    sortOrder: 2,
    children: [
      { name: 'T-Shirts & Tops', slug: 't-shirts-tops', sortOrder: 1 },
      { name: 'Bottoms (Pants & Shorts)', slug: 'bottoms', sortOrder: 2 },
      { name: 'Outerwear (Jackets & Coats)', slug: 'outerwear', sortOrder: 3 },
      { name: 'Activewear', slug: 'activewear', sortOrder: 4 },
      { name: 'Underwear & Basics', slug: 'underwear-basics', sortOrder: 5 },
      { name: 'Dresses & Skirts', slug: 'dresses-skirts', sortOrder: 6 },
      { name: 'Swimwear', slug: 'swimwear', sortOrder: 7 },
      { name: 'Woven Fabrics', slug: 'woven-fabrics', sortOrder: 8 },
      { name: 'Knit Fabrics', slug: 'knit-fabrics', sortOrder: 9 },
    ],
  },
  {
    name: 'Travel Accessories',
    slug: 'travel-accessories',
    icon: '🧳',
    description: 'Bags, luggage, and travel convenience products',
    sortOrder: 3,
    children: [
      { name: 'Luggage & Cases', slug: 'luggage-cases', sortOrder: 1 },
      { name: 'Backpacks & Bags', slug: 'backpacks-bags', sortOrder: 2 },
      { name: 'Packing Cubes & Organizers', slug: 'packing-cubes', sortOrder: 3 },
      { name: 'Passport & Document Holders', slug: 'passport-holders', sortOrder: 4 },
      { name: 'Neck Pillows & Comfort', slug: 'neck-pillows', sortOrder: 5 },
      { name: 'Travel Adapters & Tech', slug: 'travel-adapters', sortOrder: 6 },
      { name: 'Money Belts & Pouches', slug: 'money-belts', sortOrder: 7 },
    ],
  },
  {
    name: 'Bathroom Products',
    slug: 'bathroom-products',
    icon: '🚿',
    description: 'Bathroom fixtures, hardware, and accessories',
    sortOrder: 4,
    children: [
      { name: 'Faucets & Taps', slug: 'faucets-taps', sortOrder: 1 },
      { name: 'Showerheads & Rails', slug: 'showerheads-rails', sortOrder: 2 },
      { name: 'Towel Rails & Holders', slug: 'towel-rails', sortOrder: 3 },
      { name: 'Toilet Accessories', slug: 'toilet-accessories', sortOrder: 4 },
      { name: 'Soap Dispensers & Holders', slug: 'soap-dispensers', sortOrder: 5 },
      { name: 'Mirror & Vanity Accessories', slug: 'mirror-vanity', sortOrder: 6 },
      { name: 'Bath Mats & Textiles', slug: 'bath-mats', sortOrder: 7 },
    ],
  },
  {
    name: 'Ironmongery & Hardware',
    slug: 'ironmongery-hardware',
    icon: '🔩',
    description: 'Door, cabinet, and architectural hardware',
    sortOrder: 5,
    children: [
      { name: 'Door Hardware', slug: 'door-hardware', sortOrder: 1 },
      { name: 'Cabinet Hardware', slug: 'cabinet-hardware', sortOrder: 2 },
      { name: 'Hinges & Pins', slug: 'hinges-pins', sortOrder: 3 },
      { name: 'Window Hardware', slug: 'window-hardware', sortOrder: 4 },
      { name: 'Architectural Fittings', slug: 'architectural-fittings', sortOrder: 5 },
      { name: 'Fasteners & Fixings', slug: 'fasteners-fixings', sortOrder: 6 },
    ],
  },
  {
    name: 'Car Parts & Accessories',
    slug: 'car-parts-accessories',
    icon: '🚗',
    description: 'Consumable auto parts and non-technical car accessories',
    sortOrder: 6,
    children: [
      { name: 'Filters (Air/Oil/Fuel/Cabin)', slug: 'filters', sortOrder: 1 },
      { name: 'Brake Pads', slug: 'brake-pads', sortOrder: 2 },
      { name: 'Wiper Blades', slug: 'wiper-blades', sortOrder: 3 },
      { name: 'Bulbs & LED Upgrades', slug: 'bulbs-leds', sortOrder: 4 },
      { name: 'Interior Accessories', slug: 'interior-accessories', sortOrder: 5 },
      { name: 'Seat Covers & Mats', slug: 'seat-covers-mats', sortOrder: 6 },
      { name: 'Car Care & Cleaning', slug: 'car-care', sortOrder: 7 },
      { name: 'Exterior Accessories', slug: 'exterior-accessories', sortOrder: 8 },
      { name: 'Dash Cameras & Electronics', slug: 'dash-cams', sortOrder: 9 },
    ],
  },
];

// ─── Helper: build slug from name ─────────────────────────────────────────────
const toSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ─── GET /api/products/categories/tree ────────────────────────────────────────
// Returns full hierarchy: parents with recursively-nested children. Phase 4.20.1
// fix — earlier shape only attached direct children to roots, so grandchildren
// (e.g. Resilient → Engineered SPC) were never reachable from the tree. The
// desktop ProductTaxonomy / mobile product-taxonomy renderers walk the
// `children` arrays depth-first, so the recursive build is required for the
// "click sub-category to see its children" UX.
const getCategoryTree = async (req, res) => {
  try {
    const all = await db.ProductCategory.findAll({
      where: { isActive: true, ...archivedWhere(req) },
      order: [
        ['sortOrder', 'ASC'],
        ['name', 'ASC'],
      ],
    });

    const childMap = {};
    all.filter(c => c.parentId).forEach(c => {
      if (!childMap[c.parentId]) childMap[c.parentId] = [];
      childMap[c.parentId].push(c);
    });

    const buildNode = (node) => ({
      ...node.toJSON(),
      children: (childMap[node.id] || [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(buildNode),
    });

    const tree = all.filter(c => !c.parentId).map(buildNode);

    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/products/categories/flat ────────────────────────────────────────
// Flat list including parentId — used by product form dropdowns
const getCategoriesFlat = async (req, res) => {
  try {
    const categories = await db.ProductCategory.findAll({
      where: { isActive: true, ...archivedWhere(req) },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/products/categories ────────────────────────────────────────────
const createCategory = async (req, res) => {
  try {
    const { name, description, icon, parentId, sortOrder } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });

    const category = await db.ProductCategory.create({
      name: name.trim(),
      slug: toSlug(name),
      description: description || null,
      icon: icon || null,
      parentId: parentId || null,
      sortOrder: sortOrder ?? 99,
      isActive: true,
    });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PUT /api/products/categories/:id ─────────────────────────────────────────
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, sortOrder, isActive } = req.body;

    const category = await db.ProductCategory.findByPk(id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    const updates = {};
    if (name !== undefined) { updates.name = name.trim(); updates.slug = toSlug(name); }
    if (description !== undefined) updates.description = description;
    if (icon !== undefined) updates.icon = icon;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (isActive !== undefined) updates.isActive = isActive;

    await category.update(updates);
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE /api/products/categories/:id ──────────────────────────────────────
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await db.ProductCategory.findByPk(id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    // Count children
    const childCount = await db.ProductCategory.count({ where: { parentId: id } });
    if (childCount > 0) {
      // Delete children first, then parent
      await db.ProductCategory.destroy({ where: { parentId: id } });
    }

    await category.destroy();
    res.json({ success: true, deleted: 1 + childCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/products/categories/seed ───────────────────────────────────────
// Seeds the Sovern House default taxonomy. Idempotent — skips existing slugs.
const seedDefaultTemplate = async (req, res) => {
  try {
    const { overwrite } = req.body;

    if (overwrite) {
      await db.ProductCategory.destroy({ where: {} });
    }

    let created = 0;
    let skipped = 0;

    for (const parent of SOVERN_HOUSE_TEMPLATE) {
      // Check for existing parent by slug
      const existing = await db.ProductCategory.findOne({ where: { slug: parent.slug, parentId: null } });
      let parentRecord;

      if (existing && !overwrite) {
        skipped++;
        parentRecord = existing;
      } else if (!existing) {
        parentRecord = await db.ProductCategory.create({
          name: parent.name,
          slug: parent.slug,
          icon: parent.icon || null,
          description: parent.description || null,
          sortOrder: parent.sortOrder,
          parentId: null,
          isActive: true,
        });
        created++;
      } else {
        parentRecord = existing;
      }

      // Children
      for (const child of (parent.children || [])) {
        const existingChild = await db.ProductCategory.findOne({
          where: { slug: child.slug, parentId: parentRecord.id },
        });
        if (!existingChild) {
          await db.ProductCategory.create({
            name: child.name,
            slug: child.slug,
            icon: child.icon || null,
            sortOrder: child.sortOrder,
            parentId: parentRecord.id,
            isActive: true,
          });
          created++;
        } else {
          skipped++;
        }
      }
    }

    res.json({ success: true, created, skipped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/products/categories/export ──────────────────────────────────────
// Exports the full tree as downloadable JSON
const exportCategories = async (req, res) => {
  try {
    // Export ALWAYS includes archived rows so the snapshot is faithful.
    // Callers can re-import + re-archive deterministically.
    const all = await db.ProductCategory.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });

    const parents = all.filter(c => !c.parentId);
    const childMap = {};
    all.filter(c => c.parentId).forEach(c => {
      if (!childMap[c.parentId]) childMap[c.parentId] = [];
      childMap[c.parentId].push(c.toJSON());
    });

    const tree = parents.map(p => ({
      name: p.name,
      slug: p.slug,
      icon: p.icon,
      description: p.description,
      sortOrder: p.sortOrder,
      isArchived: p.isArchived,
      children: (childMap[p.id] || []).map(c => ({
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        sortOrder: c.sortOrder,
        isArchived: c.isArchived,
      })),
    }));

    res.setHeader('Content-Disposition', 'attachment; filename="product-taxonomy.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(tree);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/products/categories/import ─────────────────────────────────────
// Imports from exported JSON. Clears existing if overwrite=true.
const importCategories = async (req, res) => {
  try {
    const { categories, overwrite } = req.body;
    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ success: false, message: 'categories array is required' });
    }

    if (overwrite) {
      await db.ProductCategory.destroy({ where: {} });
    }

    let created = 0;
    for (const parent of categories) {
      const parentRecord = await db.ProductCategory.create({
        name: parent.name,
        slug: parent.slug || toSlug(parent.name),
        icon: parent.icon || null,
        description: parent.description || null,
        sortOrder: parent.sortOrder ?? 99,
        parentId: null,
        isActive: true,
      });
      created++;

      for (const child of (parent.children || [])) {
        await db.ProductCategory.create({
          name: child.name,
          slug: child.slug || toSlug(child.name),
          icon: child.icon || null,
          sortOrder: child.sortOrder ?? 99,
          parentId: parentRecord.id,
          isActive: true,
        });
        created++;
      }
    }

    res.json({ success: true, created });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Templates CRUD ───────────────────────────────────────────────────────────

const getTemplates = async (req, res) => {
  try {
    const templates = await db.CategoryTemplate.findAll({ order: [['createdAt', 'ASC']] });
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const saveAsTemplate = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Template name is required' });

    // Snapshot current taxonomy
    const all = await db.ProductCategory.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });
    const parents = all.filter(c => !c.parentId);
    const childMap = {};
    all.filter(c => c.parentId).forEach(c => {
      if (!childMap[c.parentId]) childMap[c.parentId] = [];
      childMap[c.parentId].push(c.toJSON());
    });
    const snapshot = parents.map(p => ({
      name: p.name, slug: p.slug, icon: p.icon, description: p.description, sortOrder: p.sortOrder,
      children: (childMap[p.id] || []).map(c => ({ name: c.name, slug: c.slug, icon: c.icon, sortOrder: c.sortOrder })),
    }));

    const template = await db.CategoryTemplate.create({ name, description: description || null, categories: snapshot });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const loadTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { overwrite } = req.body;

    let categories;

    if (id === 'sovern-house') {
      // Built-in template — not stored in DB
      categories = SOVERN_HOUSE_TEMPLATE;
    } else {
      const template = await db.CategoryTemplate.findByPk(id);
      if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
      categories = template.categories;
    }

    if (overwrite) {
      await db.ProductCategory.destroy({ where: {} });
    }

    let created = 0;
    for (const parent of categories) {
      const parentRecord = await db.ProductCategory.create({
        name: parent.name, slug: parent.slug || toSlug(parent.name),
        icon: parent.icon || null, description: parent.description || null,
        sortOrder: parent.sortOrder ?? 99, parentId: null, isActive: true,
      });
      created++;
      for (const child of (parent.children || [])) {
        await db.ProductCategory.create({
          name: child.name, slug: child.slug || toSlug(child.name),
          icon: child.icon || null, sortOrder: child.sortOrder ?? 99,
          parentId: parentRecord.id, isActive: true,
        });
        created++;
      }
    }

    res.json({ success: true, created });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await db.CategoryTemplate.findByPk(id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    if (template.isSystem) return res.status(403).json({ success: false, message: 'Cannot delete a system template' });
    await template.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PATCH /api/products/categories/:id/archive ────────────────────────────
// Phase 4.5 C21 follow-up. Soft-hides a category from default UIs while
// keeping the row queryable (and restorable). Cascades to direct children
// since archiving a parent without its children leaves orphan rows visible
// on the default filter.
const archiveCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await db.ProductCategory.findByPk(id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    const children = await db.ProductCategory.findAll({ where: { parentId: id } });
    await category.update({ isArchived: true });
    for (const c of children) await c.update({ isArchived: true });

    auditService.logAction(
      req.user?.id,
      'taxonomy_archive',
      'ProductCategory',
      id,
      { name: category.name, slug: category.slug, childrenArchived: children.length },
      req.ip,
    ).catch(() => {});

    res.json({ success: true, data: { id, archivedChildren: children.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PATCH /api/products/categories/:id/restore ────────────────────────────
// Reverse of archive. Restores the category AND its direct children so
// parent + subs reappear together.
const restoreCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await db.ProductCategory.findByPk(id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    const children = await db.ProductCategory.findAll({ where: { parentId: id } });
    await category.update({ isArchived: false });
    for (const c of children) await c.update({ isArchived: false });

    auditService.logAction(
      req.user?.id,
      'taxonomy_restore',
      'ProductCategory',
      id,
      { name: category.name, slug: category.slug, childrenRestored: children.length },
      req.ip,
    ).catch(() => {});

    res.json({ success: true, data: { id, restoredChildren: children.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCategoryTree,
  getCategoriesFlat,
  createCategory,
  updateCategory,
  deleteCategory,
  seedDefaultTemplate,
  exportCategories,
  importCategories,
  getTemplates,
  saveAsTemplate,
  loadTemplate,
  deleteTemplate,
  archiveCategory,
  restoreCategory,
};
