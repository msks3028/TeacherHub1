import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronUp, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import api from "../../services/api";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import Icon from "../ui/Icon";
import { Input, Textarea } from "../ui/Form";
import { useConfirm } from "../../context/ConfirmContext";

export default function CourseUnitsPanel({ course, onChanged }) {
  const confirm = useConfirm();
  const [unitEditor, setUnitEditor] = useState(null);
  const [lessonEditor, setLessonEditor] = useState(null);
  const [unitForm, setUnitForm] = useState({ title: "", description: "" });
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", date: "" });
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const draggedLessonRef = useRef(null);
  const units = course.units || [];

  function openUnit(unit = null) {
    setUnitEditor(unit || { id: null });
    setUnitForm({ title: unit?.title || "", description: unit?.description || "" });
  }

  async function saveUnit(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (unitEditor.id) await api.put(`/teacher/courses/${course.id}/units/${unitEditor.id}`, unitForm);
      else await api.post(`/teacher/courses/${course.id}/units`, unitForm);
      toast.success("تم حفظ الوحدة."); setUnitEditor(null); onChanged();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function removeUnit(unit) {
    if (!(await confirm({ title: "حذف الوحدة", message: "سيتم نقل دروسها إلى أول وحدة متبقية. هل تريد المتابعة؟", confirmLabel: "حذف الوحدة" }))) return;
    try { await api.delete(`/teacher/courses/${course.id}/units/${unit.id}`); toast.success("تم حذف الوحدة."); onChanged(); }
    catch (err) { toast.error(err.message); }
  }

  async function moveUnit(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= units.length) return;
    const ids = units.map((unit) => unit.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    try { await api.patch(`/teacher/courses/${course.id}/units/reorder`, { unitIds: ids }); onChanged(); }
    catch (err) { toast.error(err.message); }
  }

  function openLesson(unit, lesson = null) {
    setLessonEditor({ unitId: unit.id, lesson });
    setLessonForm({ title: lesson?.title || "", description: lesson?.description || "", date: lesson?.date ? new Date(lesson.date).toISOString().slice(0, 16) : "" });
  }

  async function saveLesson(e) {
    e.preventDefault(); setSaving(true);
    const payload = { ...lessonForm, courseId: course.id, unitId: lessonEditor.unitId, date: lessonForm.date || null };
    try {
      if (lessonEditor.lesson) await api.put(`/teacher/lessons/${lessonEditor.lesson.id}`, payload);
      else await api.post("/teacher/lessons", payload);
      toast.success("تم حفظ الدرس."); setLessonEditor(null); onChanged();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function duplicateLesson(lesson) {
    try {
      await api.post(`/teacher/lessons/${lesson.id}/duplicate`);
      toast.success("تم نسخ الدرس. المرفقات لا تُنسخ تلقائيًا."); onChanged();
    } catch (err) { toast.error(err.message); }
  }

  async function removeLesson(lesson) {
    if (!(await confirm({ title: "حذف الدرس", message: "سيتم حذف ارتباط الفيديوهات والملفات والواجبات بهذا الدرس. لا يمكن التراجع.", confirmLabel: "حذف الدرس" }))) return;
    try { await api.delete(`/teacher/lessons/${lesson.id}`); toast.success("تم حذف الدرس."); onChanged(); }
    catch (err) { toast.error(err.message); }
  }

  async function moveLesson(unit, index, delta) {
    const next = index + delta;
    if (next < 0 || next >= unit.lessons.length) return;
    const ids = unit.lessons.map((lesson) => lesson.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    try { await api.patch(`/teacher/courses/${course.id}/units/${unit.id}/lessons/reorder`, { unitId: unit.id, lessonIds: ids }); onChanged(); }
    catch (err) { toast.error(err.message); }
  }

  async function dropLesson(unit, destinationIndex) {
    const dragged = draggedLessonRef.current;
    draggedLessonRef.current = null;
    if (!dragged || dragged.unitId !== unit.id || dragged.lessonId === unit.lessons[destinationIndex]?.id || reordering) return;
    const ids = unit.lessons.map((lesson) => lesson.id);
    const from = ids.indexOf(dragged.lessonId);
    if (from < 0) return;
    const [lessonId] = ids.splice(from, 1);
    ids.splice(from < destinationIndex ? destinationIndex - 1 : destinationIndex, 0, lessonId);
    setReordering(true);
    try {
      await api.patch(`/teacher/courses/${course.id}/units/${unit.id}/lessons/reorder`, { unitId: unit.id, lessonIds: ids });
      onChanged();
    } catch (err) { toast.error(err.message); }
    finally { setReordering(false); }
  }

  return <section className="mt-6 mb-8" aria-labelledby="course-units-heading">
    <header className="flex flex-wrap items-end justify-between gap-3 mb-3"><div><h2 id="course-units-heading" className="font-display text-xl font-bold text-ink">الوحدات والدروس</h2><p className="text-sm text-ink-3">اسحب الدرس لإعادة ترتيبه داخل وحدته، أو استخدم أزرار النقل بلوحة المفاتيح.</p></div><div className="flex gap-2"><Button size="sm" variant="secondary" className="min-h-[44px]" icon={Plus} onClick={() => openUnit()}>إضافة وحدة</Button></div></header>
    <div className="space-y-3">
      {units.map((unit, unitIndex) => <article key={unit.id} className="card p-3 sm:p-4 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex flex-col">
            <Button variant="ghost" size="sm" iconOnly className="min-h-[44px] min-w-[44px]" aria-label={`نقل وحدة ${unit.title} للأعلى`} disabled={unitIndex === 0} onClick={() => moveUnit(unitIndex, -1)}><Icon icon={ChevronUp} size={18} /></Button>
            <Button variant="ghost" size="sm" iconOnly className="min-h-[44px] min-w-[44px]" aria-label={`نقل وحدة ${unit.title} للأسفل`} disabled={unitIndex === units.length - 1} onClick={() => moveUnit(unitIndex, 1)}><Icon icon={ChevronDown} size={18} /></Button>
          </div>
          <div className="min-w-0 flex-1"><h3 className="font-bold text-ink break-words">{unit.title}</h3>{unit.description && <p className="mt-1 text-sm text-ink-2 whitespace-pre-wrap break-words">{unit.description}</p>}<p className="mt-1 text-xs text-ink-3">{unit.lessons.length} درس</p></div>
          <div className="flex gap-1 shrink-0"><Button variant="ghost" size="sm" iconOnly className="min-h-[44px] min-w-[44px]" aria-label={`تعديل وحدة ${unit.title}`} onClick={() => openUnit(unit)}><Icon icon={Pencil} size={16} /></Button><Button variant="ghost" size="sm" iconOnly className="min-h-[44px] min-w-[44px]" aria-label={`حذف وحدة ${unit.title}`} disabled={units.length < 2} onClick={() => removeUnit(unit)}><Icon icon={Trash2} size={16} /></Button></div>
        </div>
        <div className="mt-3 ms-9 space-y-2">
          {unit.lessons.map((lesson, lessonIndex) => <div key={lesson.id} draggable={!reordering} onDragStart={(event) => { draggedLessonRef.current = { lessonId: lesson.id, unitId: unit.id }; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", lesson.id); }} onDragEnd={() => { draggedLessonRef.current = null; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); dropLesson(unit, lessonIndex); }} className="rounded bg-sunken p-2.5 flex items-center gap-2 min-w-0">
            <div className="flex flex-col"><Button variant="ghost" size="sm" iconOnly className="min-h-[44px] min-w-[44px]" aria-label={`نقل درس ${lesson.title} للأعلى`} disabled={lessonIndex === 0} onClick={() => moveLesson(unit, lessonIndex, -1)}><Icon icon={ChevronUp} size={17} /></Button><Button variant="ghost" size="sm" iconOnly className="min-h-[44px] min-w-[44px]" aria-label={`نقل درس ${lesson.title} للأسفل`} disabled={lessonIndex === unit.lessons.length - 1} onClick={() => moveLesson(unit, lessonIndex, 1)}><Icon icon={ChevronDown} size={17} /></Button></div>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink break-words">{lesson.title}</p><p className="text-xs text-ink-3">{lesson._count?.videos || 0} فيديو · {lesson._count?.materials || 0} ملف · {lesson._count?.homework || 0} واجب</p></div>
            <div className="flex flex-wrap justify-end shrink-0"><Button variant="ghost" size="sm" iconOnly className="min-h-[44px] min-w-[44px]" aria-label={`تعديل درس ${lesson.title}`} onClick={() => openLesson(unit, lesson)}><Icon icon={Pencil} size={15} /></Button><Button variant="ghost" size="sm" iconOnly className="min-h-[44px] min-w-[44px]" aria-label={`نسخ درس ${lesson.title}`} onClick={() => duplicateLesson(lesson)}><Icon icon={Copy} size={15} /></Button><Button variant="ghost" size="sm" iconOnly className="min-h-[44px] min-w-[44px]" aria-label={`حذف درس ${lesson.title}`} onClick={() => removeLesson(lesson)}><Icon icon={Trash2} size={15} /></Button></div>
          </div>)}
          {unit.lessons.length === 0 && <p className="py-2 text-sm text-ink-3">لا توجد دروس في هذه الوحدة بعد.</p>}
          <Button size="sm" variant="soft" className="min-h-[44px]" icon={Plus} onClick={() => openLesson(unit)}>إضافة درس</Button>
        </div>
      </article>)}
    </div>
    <Modal open={!!unitEditor} onClose={() => setUnitEditor(null)} title={unitEditor?.id ? "تعديل الوحدة" : "إضافة وحدة"} footer={<><Button variant="secondary" onClick={() => setUnitEditor(null)}>إلغاء</Button><Button type="submit" form="unit-form" loading={saving}>حفظ</Button></>}><form id="unit-form" onSubmit={saveUnit} className="space-y-4"><Input label="اسم الوحدة" required maxLength={200} value={unitForm.title} onChange={(e) => setUnitForm({ ...unitForm, title: e.target.value })} /><Textarea label="وصف مختصر (اختياري)" rows={3} maxLength={3000} value={unitForm.description} onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })} /></form></Modal>
    <Modal open={!!lessonEditor} onClose={() => setLessonEditor(null)} title={lessonEditor?.lesson ? "تعديل الدرس" : "إضافة درس"} footer={<><Button variant="secondary" onClick={() => setLessonEditor(null)}>إلغاء</Button><Button type="submit" form="lesson-form" loading={saving}>حفظ الدرس</Button></>}><form id="lesson-form" onSubmit={saveLesson} className="space-y-4"><Input label="عنوان الدرس" required maxLength={200} value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} /><Textarea label="وصف الدرس" rows={4} maxLength={5000} value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} /><Input label="موعد الدرس (اختياري)" type="datetime-local" value={lessonForm.date} onChange={(e) => setLessonForm({ ...lessonForm, date: e.target.value })} /></form></Modal>
  </section>;
}
