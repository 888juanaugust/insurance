import Link from 'next/link';
import { requirePermission } from '@/lib/guard';
import { listUsers, countMasters } from '@/lib/queries';
import { ROLES, ROLE_LABEL, ROLE_DESCRIPTION, permissionsOf, DENIAL, isRole } from '@/lib/permissions';
import { setUserRoleAction } from '@/lib/user-actions';
import { Crumb, PageHeader, Help } from '@/components/ui';

export const dynamic = 'force-dynamic';

function label(role: string): string {
  return isRole(role) ? ROLE_LABEL[role] : `${role} (unknown)`;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const user = await requirePermission('user.manage');
  const { msg } = await searchParams;
  const users = listUsers(user.org_id);
  const masters = countMasters(user.org_id);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/team', label: 'Team' }, { label: 'Users and roles' }]} />
        <PageHeader
          title="Users and roles"
          subtitle="What each person signed in to Insurhelp is allowed to do."
          meta={`${users.length} named ${users.length === 1 ? 'user' : 'users'} · ${masters} Master`}
        />
        {msg && (
          <p role="status" className="mt-4 rounded border border-line bg-ok-wash px-4 py-3 text-[13px] text-ok">
            {msg}
          </p>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          Named users
          <Help text="Changing a role takes effect on the person's next request. Every change is written to the audit trail." />
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Login ID</th>
                <th>Agent code</th>
                <th>Status</th>
                <th className="w-72">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const lastMaster = u.role === 'master' && masters <= 1;
                return (
                  <tr key={u.id}>
                    <td className="font-semibold text-ink">
                      {u.name}
                      {u.id === user.id && <span className="ml-2 badge badge-blue">you</span>}
                    </td>
                    <td className="text-ink-soft">{u.email}</td>
                    <td className="text-ink-soft">{u.agent_code ?? '—'}</td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-grey'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>
                      {/*
                        The role in force is server-rendered text, and the
                        control beside it only ever says what to change it to.
                        A dropdown that doubles as the current value goes on
                        showing a rejected choice after a refusal, which reads
                        as the opposite of what happened.
                      */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge-blue">{label(u.role)}</span>
                        <form action={setUserRoleAction} className="flex items-center gap-2">
                          <input type="hidden" name="user_id" value={u.id} />
                          <label htmlFor={`role-${u.id}`} className="text-[12px] text-muted">
                            change to
                          </label>
                          <select
                            id={`role-${u.id}`}
                            name="role"
                            defaultValue=""
                            aria-label={`Change the role of ${u.name}`}
                            className="inp h-8 w-36 cursor-pointer text-[13px]"
                          >
                            <option value="">choose…</option>
                            {ROLES.filter((r) => r !== u.role).map((r) => (
                              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                            ))}
                          </select>
                          <button type="submit" className="btn btn-ghost h-8">Set</button>
                        </form>
                      </div>
                      {lastMaster && (
                        <p className="mt-1 text-[12px] text-muted">
                          The only Master — promote someone else before changing this.
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-6 py-3 text-[12.5px] text-muted">
          Roles are checked on the server for every action, not just hidden in the interface — a
          button you cannot see is not a permission you can post your way around.{' '}
          <Link href="/audit" className="link-red">See the audit trail</Link>.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head">What each role can do</div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-32">Role</th>
                <th className="w-96">Meant for</th>
                <th>Permitted</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r} className="align-top">
                  <td className="font-semibold text-brand">{ROLE_LABEL[r]}</td>
                  <td className="text-ink-soft">{ROLE_DESCRIPTION[r]}</td>
                  <td className="text-muted">
                    <span className="text-[12.5px]">
                      {permissionsOf(r).map((p) => DENIAL[p]).join(' · ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
