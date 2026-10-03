const prisma = require("../config/db");
const { isString } = require("../utils/validate");
const { audit } = require("../services/auditService");

async function ownedCourse(courseId, teacherId) {
  return prisma.course.findFirst({ where: { id: courseId, teacherId }, select: { id: true } });
}

async function createUnit(req, res) {
  const { title, description } = req.body || {};
  const course = await ownedCourse(req.params.courseId, req.user.id);
  if (!course) return res.status(404).json({ message: "الكورس غير موجود." });
  if (!isString(title, { min: 1, max: 200 }) || (description != null && !isString(description, { max: 3000 }))) return res.status(400).json({ message: "عنوان الوحدة غير صالح." });
  const aggregate = await prisma.unit.aggregate({ where: { courseId: course.id }, _max: { position: true } });
  const unit = await prisma.unit.create({ data: { courseId: course.id, title: title.trim(), description: description?.trim() || null, position: (aggregate._max.position ?? -1) + 1 } });
  audit(req, "course_unit_created", { targetType: "unit", targetId: unit.id });
  res.status(201).json({ unit });
}

async function updateUnit(req, res) {
  const course = await ownedCourse(req.params.courseId, req.user.id);
  if (!course) return res.status(404).json({ message: "الكورس غير موجود." });
  const unit = await prisma.unit.findFirst({ where: { id: req.params.unitId, courseId: course.id } });
  if (!unit) return res.status(404).json({ message: "الوحدة غير موجودة." });
  const { title, description } = req.body || {};
  if (title !== undefined && !isString(title, { min: 1, max: 200 })) return res.status(400).json({ message: "عنوان الوحدة غير صالح." });
  if (description !== undefined && description != null && !isString(description, { max: 3000 })) return res.status(400).json({ message: "وصف الوحدة غير صالح." });
  const updated = await prisma.unit.update({ where: { id: unit.id }, data: { ...(title !== undefined ? { title: title.trim() } : {}), ...(description !== undefined ? { description: description?.trim() || null } : {}) } });
  audit(req, "course_unit_updated", { targetType: "unit", targetId: unit.id });
  res.json({ unit: updated });
}

async function deleteUnit(req, res) {
  const course = await ownedCourse(req.params.courseId, req.user.id);
  if (!course) return res.status(404).json({ message: "الكورس غير موجود." });
  const unit = await prisma.unit.findFirst({ where: { id: req.params.unitId, courseId: course.id } });
  if (!unit) return res.status(404).json({ message: "الوحدة غير موجودة." });
  const remaining = await prisma.unit.findMany({ where: { courseId: course.id, id: { not: unit.id } }, orderBy: { position: "asc" }, select: { id: true } });
  if (!remaining.length) return res.status(409).json({ message: "يجب أن يحتوي الكورس على وحدة واحدة على الأقل." });
  await prisma.$transaction(async (tx) => {
    const destinationId = remaining[0].id;
    const destinationLessons = await tx.lesson.findMany({ where: { unitId: destinationId }, orderBy: { position: "asc" }, select: { id: true } });
    const lessons = await tx.lesson.findMany({ where: { unitId: unit.id }, orderBy: { position: "asc" }, select: { id: true } });
    const lessonMax = await tx.lesson.aggregate({ where: { unitId: { in: [unit.id, destinationId] } }, _max: { position: true } });
    const lessonOffset = (lessonMax._max.position ?? 0) + destinationLessons.length + lessons.length + 1;
    for (let i = 0; i < lessons.length; i += 1) await tx.lesson.update({ where: { id: lessons[i].id }, data: { unitId: destinationId, position: lessonOffset + i } });
    const allLessons = [...destinationLessons.map((row) => row.id), ...lessons.map((row) => row.id)];
    for (let i = 0; i < allLessons.length; i += 1) await tx.lesson.update({ where: { id: allLessons[i] }, data: { position: lessonOffset + lessons.length + i } });
    for (let i = 0; i < allLessons.length; i += 1) await tx.lesson.update({ where: { id: allLessons[i] }, data: { position: i } });
    await tx.unit.delete({ where: { id: unit.id } });
    const unitMax = await tx.unit.aggregate({ where: { courseId: course.id }, _max: { position: true } });
    const unitOffset = (unitMax._max.position ?? 0) + remaining.length + 1;
    for (let i = 0; i < remaining.length; i += 1) await tx.unit.update({ where: { id: remaining[i].id }, data: { position: unitOffset + i } });
    for (let i = 0; i < remaining.length; i += 1) await tx.unit.update({ where: { id: remaining[i].id }, data: { position: i } });
  });
  audit(req, "course_unit_deleted", { targetType: "unit", targetId: unit.id });
  res.json({ message: "تم حذف الوحدة ونقل دروسها إلى أول وحدة متبقية." });
}

async function reorderUnits(req, res) {
  const course = await ownedCourse(req.params.courseId, req.user.id);
  if (!course) return res.status(404).json({ message: "الكورس غير موجود." });
  const ids = req.body?.unitIds;
  if (!Array.isArray(ids) || ids.length > 500 || ids.some((id) => !isString(id, { min: 1, max: 64 })) || new Set(ids).size !== ids.length) return res.status(400).json({ message: "ترتيب الوحدات غير صالح." });
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.unit.findMany({ where: { courseId: course.id }, select: { id: true } });
      if (current.length !== ids.length || current.some((unit) => !ids.includes(unit.id))) throw Object.assign(new Error("ترتيب الوحدات تغيّر. حدّث الصفحة وحاول مرة أخرى."), { statusCode: 409 });
      const aggregate = await tx.unit.aggregate({ where: { courseId: course.id }, _max: { position: true } });
      const offset = (aggregate._max.position ?? -1) + current.length + 1;
      for (let i = 0; i < current.length; i += 1) await tx.unit.update({ where: { id: current[i].id }, data: { position: offset + i } });
      for (let i = 0; i < ids.length; i += 1) await tx.unit.update({ where: { id: ids[i] }, data: { position: i } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error.statusCode === 409 || error.code === "P2034") return res.status(409).json({ message: "تغيّر ترتيب الوحدات بالتزامن. حدّث الصفحة وحاول مرة أخرى." });
    throw error;
  }
  res.json({ message: "تم حفظ ترتيب الوحدات." });
}

async function reorderLessons(req, res) {
  const course = await ownedCourse(req.params.courseId, req.user.id);
  if (!course) return res.status(404).json({ message: "الكورس غير موجود." });
  const unitId = req.body?.unitId;
  const ids = req.body?.lessonIds;
  if (!isString(unitId, { min: 1, max: 64 }) || !Array.isArray(ids) || ids.length > 5000 || ids.some((id) => !isString(id, { min: 1, max: 64 })) || new Set(ids).size !== ids.length) return res.status(400).json({ message: "ترتيب الدروس غير صالح." });
  try {
    await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.findFirst({ where: { id: unitId, courseId: course.id } });
      if (!unit) throw Object.assign(new Error("الوحدة غير موجودة."), { statusCode: 404 });
      const current = await tx.lesson.findMany({ where: { courseId: course.id, unitId }, select: { id: true } });
      if (current.length !== ids.length || current.some((lesson) => !ids.includes(lesson.id))) throw Object.assign(new Error("ترتيب الدروس تغيّر. حدّث الصفحة وحاول مرة أخرى."), { statusCode: 409 });
      const aggregate = await tx.lesson.aggregate({ where: { courseId: course.id, unitId }, _max: { position: true } });
      const offset = (aggregate._max.position ?? -1) + current.length + 1;
      for (let i = 0; i < current.length; i += 1) await tx.lesson.update({ where: { id: current[i].id }, data: { position: offset + i } });
      for (let i = 0; i < ids.length; i += 1) await tx.lesson.update({ where: { id: ids[i] }, data: { position: i } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ message: error.message });
    if (error.statusCode === 409 || error.code === "P2034") return res.status(409).json({ message: "تغيّر ترتيب الدروس بالتزامن. حدّث الصفحة وحاول مرة أخرى." });
    throw error;
  }
  res.json({ message: "تم حفظ ترتيب الدروس." });
}

module.exports = { createUnit, updateUnit, deleteUnit, reorderUnits, reorderLessons };
