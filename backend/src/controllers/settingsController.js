const prisma = require("../config/db");
const { isString, isHexColor, isSafeHttpUrl, isUploadUrl } = require("../utils/validate");

const ok = (v, test) => v === undefined || v === null || v === "" || test(v);
const isImageRef = (v) => isSafeHttpUrl(v) || isUploadUrl("image", v);

// GET /api/settings  (public-ish: needed to render login page branding too,
// but still requires at least being served by our app — no secrets stored here)
async function getSettings(req, res) {
  const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  res.json({ settings });
}

// PUT /api/teacher/settings
async function updateSettings(req, res) {
  const {
    platformName, logoUrl, faviconUrl, primaryColor, sidebarColor,
    buttonColor, textColor, backgroundColor, cardStyle, heroImageUrl,
    contactEmail, contactPhone,
  } = req.body || {};

  // These values are written into CSS variables and <img>/<link> tags on every
  // user's screen, so they are checked strictly (colors: #hex only; images: http(s) or our uploads).
  const colors = [primaryColor, sidebarColor, buttonColor, textColor, backgroundColor];
  const images = [logoUrl, faviconUrl, heroImageUrl];
  if (
    !colors.every((c) => ok(c, isHexColor)) ||
    !images.every((u) => ok(u, isImageRef)) ||
    !ok(platformName, (v) => isString(v, { max: 80 })) ||
    !ok(cardStyle, (v) => isString(v, { max: 30 })) ||
    !ok(contactEmail, (v) => isString(v, { max: 254 })) ||
    !ok(contactPhone, (v) => isString(v, { max: 30 }))
  ) {
    return res.status(400).json({ message: "قيم غير صالحة في إعدادات المظهر." });
  }

  const settings = await prisma.platformSettings.update({
    where: { id: "singleton" },
    data: {
      platformName, logoUrl, faviconUrl, primaryColor, sidebarColor,
      buttonColor, textColor, backgroundColor, cardStyle, heroImageUrl,
      contactEmail, contactPhone,
    },
  });
  res.json({ settings });
}

module.exports = { getSettings, updateSettings };
