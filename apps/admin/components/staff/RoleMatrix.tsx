import { PERMISSION_ROWS, ROLE_LABEL, STAFF_ROLES, can } from "@/lib/permissions";

export function RoleMatrix() {
  return (
    <div>
      <table>
        <caption className="sr-only">What each role can do</caption>
        <thead>
          <tr>
            <th scope="col">Permission</th>
            {STAFF_ROLES.map((r) => (
              <th key={r} scope="col">
                {ROLE_LABEL[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_ROWS.map((row) => (
            <tr key={row.action}>
              <th scope="row">{row.label}</th>
              {STAFF_ROLES.map((r) => (
                <td key={r}>{can(r, row.action) ? "✓ Yes" : "✗ No"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">No role can see transactions, notes, chat, voice or video.</p>
    </div>
  );
}
