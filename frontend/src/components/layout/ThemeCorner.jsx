import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import Button from "../ui/Button";
import Icon from "../ui/Icon";

/** Small theme switch pinned to a page corner (login / QR screens have no top bar). */
export default function ThemeCorner() {
  const { theme, toggle } = useTheme();
  return (
    <div className="absolute top-3 end-3 safe-t">
      <Button variant="ghost" iconOnly onClick={toggle} aria-label={theme === "dark" ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}>
        <Icon icon={theme === "dark" ? Sun : Moon} size={20} />
      </Button>
    </div>
  );
}
