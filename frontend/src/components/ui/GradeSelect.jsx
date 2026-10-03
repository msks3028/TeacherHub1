import { GRADES } from "../../constants/grades";
import { Select } from "./Form";

export default function GradeSelect({ value, onChange, required, placeholder = "اختر الصف الدراسي", label, className = "", ...rest }) {
  return (
    <Select label={label} required={required} value={value || ""} onChange={(e) => onChange(e.target.value)} className={className} {...rest}>
      <option value="" disabled>{placeholder}</option>
      {GRADES.map((g) => (
        <option key={g} value={g}>{g}</option>
      ))}
    </Select>
  );
}
