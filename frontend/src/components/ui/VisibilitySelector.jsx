import { GraduationCap, Layers, Users } from "lucide-react";
import GradeSelect from "./GradeSelect";
import { ChoiceGroup, Input } from "./Form";

/**
 * Lets the teacher choose who a piece of content (video/homework/material/
 * exam) is visible to: everyone, one grade, or one group. Reused across
 * every upload form so this choice is never hardcoded to "ALL_STUDENTS".
 */
export default function VisibilitySelector({ value, onChange }) {
  const { visibility, grade, group } = value;

  return (
    <div className="space-y-3">
      <ChoiceGroup
        label="لمين يظهر هذا المحتوى؟"
        value={visibility}
        onChange={(v) => onChange({ visibility: v, grade: "", group: "" })}
        options={[
          { value: "ALL_STUDENTS", label: "كل الطلاب", icon: Users },
          { value: "GRADE", label: "صف معيّن", icon: GraduationCap },
          { value: "GROUP", label: "مجموعة معيّنة", icon: Layers },
        ]}
      />
      {visibility === "GRADE" && (
        <GradeSelect required value={grade} onChange={(v) => onChange({ visibility, grade: v, group })} />
      )}
      {visibility === "GROUP" && (
        <Input required placeholder="اسم المجموعة" aria-label="اسم المجموعة" value={group || ""} onChange={(e) => onChange({ visibility, grade, group: e.target.value })} />
      )}
    </div>
  );
}
