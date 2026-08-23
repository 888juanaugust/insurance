'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorise, forbid } from './guard';
import { audit, diff } from './audit';
import {
  createSubAgent, updateSubAgent, getSubAgent, setSubAgentStatus, deleteSubAgent,
  findSubAgentByCode, subAgentPolicyCount, principalRateCeiling, type SubAgentInput,
} from './queries';

export type SubAgentFormState = {
  error?: string;
  field?: string;
  /** React resets the form after a server action, so the values come back. */
  values?: Record<string, string>;
};

const NRIC = /^\d{6}-\d{2}-\d{4}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const AGENT_CODE = /^[A-Z0-9][A-Z0-9/_-]{1,19}$/i;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}

function rate(fd: FormData, key: string): number {
  const n = Number(str(fd, key).replace(/[%\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function submitted(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === 'string' && !key.startsWith('$')) out[key] = value;
  }
  return out;
}

function reject(fd: FormData, field: string, error: string): SubAgentFormState {
  return { field, error, values: submitted(fd) };
}

export async function saveSubAgentAction(_prev: unknown, fd: FormData): Promise<SubAgentFormState> {
  const id = str(fd, 'agent_id');
  const guard = await authorise('agent.write', {
    action: id ? 'agent.update' : 'agent.create', entity: 'sub_agent', entityId: id || null,
  });
  if (!guard.ok) return { error: guard.message, values: submitted(fd) };
  const user = guard.user;

  const name = str(fd, 'name');
  const code = str(fd, 'agent_code').toUpperCase();
  const email = str(fd, 'email');
  const nric = str(fd, 'nric').toUpperCase();
  const joinDate = str(fd, 'join_date');

  if (!name) return reject(fd, 'name', 'Enter the agent’s name.');
  if (name.length > 100) return reject(fd, 'name', 'That name is too long — 100 characters at most.');

  if (code && !AGENT_CODE.test(code)) {
    return reject(fd, 'agent_code', 'An agent code is letters, digits, dash or slash — up to 20 characters.');
  }
  if (code) {
    const clash = findSubAgentByCode(user.org_id, code, id || undefined);
    if (clash) return reject(fd, 'agent_code', `${clash.name} already uses the code ${code}.`);
  }

  if (email && !EMAIL.test(email)) return reject(fd, 'email', 'That email address does not look right.');
  if (nric && !NRIC.test(nric)) return reject(fd, 'nric', 'NRIC should look like 880101-14-5566.');

  if (joinDate && joinDate > new Date().toISOString().slice(0, 10)) {
    return reject(fd, 'join_date', 'The joining date cannot be in the future.');
  }

  const motor = rate(fd, 'motor_rate');
  const nonMotor = rate(fd, 'non_motor_rate');
  const override = rate(fd, 'override_rate');

  for (const [key, value, label] of [
    ['motor_rate', motor, 'Motor rate'],
    ['non_motor_rate', nonMotor, 'Non-motor rate'],
    ['override_rate', override, 'Override rate'],
  ] as const) {
    if (Number.isNaN(value)) return reject(fd, key, `${label} must be a number.`);
    if (value < 0 || value > 100) return reject(fd, key, `${label} must be between 0 and 100.`);
  }

  // The agency keeps the difference between what the insurer pays it and what
  // it pays the agent. Above the insurer's rate, every policy loses money.
  const motorCeiling = principalRateCeiling('motor');
  const nonMotorCeiling = principalRateCeiling('non_motor');

  if (motor + override > motorCeiling.hi) {
    return reject(
      fd,
      'motor_rate',
      `Motor rate plus override comes to ${(motor + override).toFixed(2)}%, and no insurer pays the agency more than ${motorCeiling.hi}% on motor. The agency would lose money on every motor policy.`,
    );
  }
  if (nonMotor + override > nonMotorCeiling.hi) {
    return reject(
      fd,
      'non_motor_rate',
      `Non-motor rate plus override comes to ${(nonMotor + override).toFixed(2)}%, and no insurer pays the agency more than ${nonMotorCeiling.hi}% on non-motor.`,
    );
  }

  const input: SubAgentInput = {
    name,
    email: email || null,
    phone: str(fd, 'phone') || null,
    nric: nric || null,
    agent_code: code || null,
    rank: str(fd, 'rank') || null,
    motor_rate: motor,
    non_motor_rate: nonMotor,
    override_rate: override,
    bank_name: str(fd, 'bank_name') || null,
    bank_account: str(fd, 'bank_account') || null,
    einvoice_tin: str(fd, 'einvoice_tin') || null,
    self_billed: fd.get('self_billed') ? 1 : 0,
    join_date: joinDate || null,
    status: str(fd, 'status') === 'inactive' ? 'inactive' : 'active',
  };

  // Self-billing means the agency raises the e-Invoice on the agent's behalf,
  // which it cannot do without their tax number.
  if (input.self_billed && !input.einvoice_tin) {
    return reject(fd, 'einvoice_tin', 'Self-billed e-Invoice needs the agent’s TIN.');
  }

  if (id) {
    const existing = getSubAgent(id);
    if (!existing || existing.org_id !== user.org_id) {
      return { error: 'That agent could not be found.', values: submitted(fd) };
    }
    updateSubAgent(id, user.org_id, input);
    await audit(user, {
      action: 'agent.update', entity: 'sub_agent', entityId: id, entityLabel: name,
      summary: `Sub agent ${name} edited.`,
      changes: diff(existing as Record<string, unknown>, input as Record<string, unknown>, Object.keys(input)),
    });
    revalidatePath('/team');
    redirect('/team');
  }

  const newId = createSubAgent(user.org_id, input);
  await audit(user, {
    action: 'agent.create', entity: 'sub_agent', entityId: newId, entityLabel: name,
    summary: `Sub agent ${name} added on ${input.motor_rate}% motor and ${input.non_motor_rate}% non-motor.`,
  });
  revalidatePath('/team');
  redirect('/team');
}

export async function setSubAgentStatusAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const status = String(fd.get('status') ?? '') === 'inactive' ? 'inactive' : 'active';

  const guard = await authorise('agent.write', {
    action: `agent.${status === 'inactive' ? 'deactivate' : 'activate'}`, entity: 'sub_agent', entityId: id,
  });
  if (!guard.ok) forbid(guard.message);

  if (id) {
    const existing = getSubAgent(id);
    setSubAgentStatus(id, guard.user.org_id, status);
    if (existing && existing.org_id === guard.user.org_id) {
      await audit(guard.user, {
        action: `agent.${status === 'inactive' ? 'deactivate' : 'activate'}`,
        entity: 'sub_agent', entityId: id, entityLabel: existing.name,
        summary: `Sub agent ${existing.name} set ${status}.`,
        changes: { status: [existing.status, status] },
      });
    }
  }

  revalidatePath('/team');
}

export async function deleteSubAgentAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const guard = await authorise('agent.delete', { action: 'agent.delete', entity: 'sub_agent', entityId: id });
  if (!guard.ok) forbid(guard.message);
  const user = guard.user;

  if (!id) redirect('/team');

  const existing = getSubAgent(id);
  if (!existing || existing.org_id !== user.org_id) redirect('/team');

  // An agent with policies against their name is part of the record.
  if (subAgentPolicyCount(id) === 0) {
    deleteSubAgent(id, user.org_id);
    await audit(user, {
      action: 'agent.delete', entity: 'sub_agent', entityId: id, entityLabel: existing.name,
      summary: `Sub agent ${existing.name} deleted.`,
    });
  } else {
    await audit(user, {
      action: 'agent.delete', entity: 'sub_agent', entityId: id, entityLabel: existing.name,
      outcome: 'refused',
      summary: `Deletion of ${existing.name} refused — policies are written against their name.`,
    });
  }

  revalidatePath('/team');
  redirect('/team');
}
