import { listClients, listPrincipals, listAgentOptions } from './queries';

/** Options every policy form needs. */
export function policyFormOptions(orgId: string) {
  return {
    clients: listClients(orgId).map((c) => ({
      value: c.id as string,
      label: `${c.name}${c.nric || c.business_reg ? ` — ${c.nric || c.business_reg}` : ''}`,
    })),
    principals: listPrincipals().map((p) => ({
      value: p.id,
      label: p.short_name,
      motor_rate: p.motor_rate,
      non_motor_rate: p.non_motor_rate,
    })),
    agents: listAgentOptions(orgId).map((a) => ({ value: a.id, label: a.name })),
  };
}

export const CLASS_BY_SLUG: Record<string, 'motor' | 'non_motor'> = {
  motor: 'motor',
  'non-motor': 'non_motor',
};
