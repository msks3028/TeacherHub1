/**
 * Responsive table.
 *  - ≥ md : clean table with a sticky header.
 *  - < md : each row becomes a stacked card (no sideways scrolling).
 *
 * columns: [{ key, header, render?(row), primary?, mobileHide?, className? }]
 *   `primary` column becomes the card title on phones.
 * actions(row): ReactNode shown in the last column / card footer.
 */
export default function DataTable({ columns, rows, rowKey = "id", actions, actionsHeader = "إجراءات", caption }) {
  const primary = columns.find((c) => c.primary) || columns[0];
  const rest = columns.filter((c) => c !== primary && !c.mobileHide);
  const cell = (c, row) => (c.render ? c.render(row) : row[c.key] ?? "-");

  return (
    <>
      <div className="table-shell hidden md:block">
        <table className="data-table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => <th key={c.key} scope="col" className={c.className}>{c.header}</th>)}
              {actions && <th scope="col" className="w-px">{actionsHeader}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[rowKey]}>
                {columns.map((c) => <td key={c.key} className={c.className}>{cell(c, row)}</td>)}
                {actions && <td className="whitespace-nowrap">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden space-y-3 stagger">
        {rows.map((row) => (
          <li key={row[rowKey]} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 font-semibold text-ink">{cell(primary, row)}</div>
            </div>
            {rest.length > 0 && (
              <dl className="mt-3 space-y-2 text-sm">
                {rest.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-4">
                    <dt className="text-ink-3 shrink-0">{c.header}</dt>
                    <dd className="text-ink text-end min-w-0">{cell(c, row)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actions && <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center gap-2">{actions(row)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}
