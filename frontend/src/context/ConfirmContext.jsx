import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";

const ConfirmContext = createContext(null);

/**
 * Styled replacement for window.confirm().
 *   if (!(await confirm({ title, message, confirmLabel, danger }))) return;
 * A plain string is also accepted and used as the message.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setState(typeof opts === "string" ? { message: opts } : opts);
      }),
    []
  );

  const finish = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => finish(false)}
        title={state?.title || "تأكيد الإجراء"}
        footer={
          <>
            <Button variant="secondary" onClick={() => finish(false)}>{state?.cancelLabel || "إلغاء"}</Button>
            <Button variant={state?.danger === false ? "primary" : "dangerSolid"} onClick={() => finish(true)} data-autofocus>
              {state?.confirmLabel || "تأكيد"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2 leading-relaxed">{state?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
