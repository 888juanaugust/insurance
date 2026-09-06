'use client';

import { useActionState, useState } from 'react';
import {
  addAccountAction, setAccountStatusAction, resetPasswordAction, type AccountState,
} from '@/lib/user-actions';
import { MIN_PASSWORD } from '@/lib/passwords';
import ConfirmSubmit from './Confirm';
import { Help } from './ui';

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  /** Seeded with the code: its password is public. */
  demo: boolean;
  /** Still on the seeded password, whoever created it. */
  demoPassword: boolean;
};

/**
 * Who can sign in to the agency application.
 *
 * Add a colleague, reset a password for someone locked out, retire an account
 * — and retire the seeded demo accounts, which arrive with a password anyone
 * who has seen the code knows. Those are flagged in red until they are
 * disabled or given a real password.
 */
export default function AccountsPanel({ accounts, me }: { accounts: AccountRow[]; me: string }) {
  const [adding, setAdding] = useState(false);
  const exposed = accounts.filter((a) => a.status === 'active' && (a.demo || a.demoPassword));

  return (
    <div className="panel">
      <div className="panel-head">
        Sign-in accounts
        <Help text="Everyone who can sign in to this agency's application. Each account has full access to the agency's data; a disabled one stops at its next request." />
        <span className="ml-auto text-[12px] font-normal text-muted">
          {accounts.filter((a) => a.status === 'active').length} can sign in
        </span>
      </div>

      {exposed.length > 0 && (
        <p role="alert" className="border-b border-danger-line bg-danger-wash px-5 py-3 text-[13px] text-danger">
          <strong>{exposed.length === 1 ? 'An account' : `${exposed.length} accounts`} on a public password.</strong>{' '}
          {exposed.map((a) => a.name).join(', ')}{' '}
          {exposed.length === 1
            ? 'is a seeded demo account, or still uses the demo password from the code,'
            : 'are seeded demo accounts, or still use the demo password from the code,'}{' '}
          which anyone who has seen the repository knows. Add your own account, sign in as yourself, then disable
          {exposed.length === 1 ? ' it' : ' them'} or set a real password.
        </p>
      )}

      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Login ID</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <Row key={a.id} a={a} me={me} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-line px-5 py-3.5">
        {adding ? (
          <AddForm onDone={() => setAdding(false)} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="btn btn-primary">
            Add an account
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ a, me }: { a: AccountRow; me: string }) {
  const [state, action, pending] = useActionState(setAccountStatusAction, null as AccountState | null);
  const [resetting, setResetting] = useState(false);
  const active = a.status === 'active';
  const self = a.id === me;

  return (
    <>
      <tr>
        <td className="font-semibold text-ink">
          {a.name}
          {self && <span className="ml-1.5 badge badge-blue">you</span>}
        </td>
        <td className="text-ink-soft">{a.email}</td>
        <td>
          <span className={`badge ${active ? 'badge-green' : 'badge-grey'}`}>{active ? 'Active' : 'Disabled'}</span>
          {active && a.demo && (
            <span className="ml-1.5 badge badge-red" title="Seeded with the code. Its password is in the repository.">
              seeded demo account
            </span>
          )}
          {active && !a.demo && a.demoPassword && (
            <span className="ml-1.5 badge badge-red" title="Still on the password from the seed file.">
              demo password
            </span>
          )}
        </td>
        <td>
          <div className="flex flex-wrap items-center gap-2.5 text-[12.5px]">
            <button type="button" onClick={() => setResetting((r) => !r)} className="text-link hover:underline">
              {resetting ? 'Cancel reset' : 'Reset password'}
            </button>
            <form action={action}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="status" value={active ? 'disabled' : 'active'} />
              {active ? (
                <ConfirmSubmit
                  label="Disable"
                  className="text-danger hover:underline disabled:opacity-50"
                  disabled={pending || self}
                  danger
                  yes="Disable it"
                  question={<>Stop <strong>{a.name}</strong> signing in? Any session they hold ends at their next request. It can be re-enabled later.</>}
                />
              ) : (
                <button type="submit" disabled={pending} className="text-link hover:underline">Enable</button>
              )}
            </form>
            {state?.error && <span role="alert" className="font-medium text-danger">{state.error}</span>}
            {state?.ok && <span role="status" className="font-medium text-ok">{state.message}</span>}
          </div>
        </td>
      </tr>
      {resetting && (
        <tr>
          <td colSpan={4} className="bg-canvas">
            <ResetForm id={a.id} name={a.name} onDone={() => setResetting(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function PasswordPair() {
  return (
    <>
      <div className="min-w-[180px] flex-1">
        <label htmlFor="password" className="sec-label mb-1 block">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          className="inp text-[13px]"
        />
      </div>
      <div className="min-w-[180px] flex-1">
        <label htmlFor="confirm" className="sec-label mb-1 block">Again</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          className="inp text-[13px]"
        />
      </div>
    </>
  );
}

function ResetForm({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null as AccountState | null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 px-2 py-2">
      <input type="hidden" name="id" value={id} />
      <span className="basis-full text-[12.5px] text-ink-soft">
        New password for <strong>{name}</strong> — at least {MIN_PASSWORD} characters, with a letter and a number.
      </span>
      <PasswordPair />
      <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
        {pending ? 'Setting…' : 'Set password'}
      </button>
      <button type="button" onClick={onDone} className="btn btn-ghost">Close</button>
      {state?.error && <p role="alert" className="basis-full text-[12.5px] font-medium text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="basis-full text-[12.5px] font-medium text-ok">{state.message}</p>}
    </form>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(addAccountAction, null as AccountState | null);
  const echo = state?.values;
  const stamp = echo ? `${echo.name}|${echo.email}` : '';

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[180px] flex-1">
        <label htmlFor="name" className="sec-label mb-1 block">Name</label>
        <input id="name" name="name" key={`name-${stamp}`} defaultValue={echo?.name ?? ''} required className="inp text-[13px]" />
      </div>
      <div className="min-w-[220px] flex-1">
        <label htmlFor="email" className="sec-label mb-1 block">Login ID (email)</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          key={`email-${stamp}`}
          defaultValue={echo?.email ?? ''}
          required
          className="inp text-[13px]"
        />
      </div>
      <PasswordPair />
      <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
        {pending ? 'Adding…' : 'Add'}
      </button>
      <button type="button" onClick={onDone} className="btn btn-ghost">Cancel</button>
      <p className="basis-full text-[12px] text-muted">
        Passwords are at least {MIN_PASSWORD} characters with a letter and a number. Tell the person theirs in
        person; the system never emails one.
      </p>
      {state?.error && <p role="alert" className="basis-full text-[12.5px] font-medium text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="basis-full text-[12.5px] font-medium text-ok">{state.message}</p>}
    </form>
  );
}
