/** The 15 non-motor classes of business carried on the live register. */
export const NON_MOTOR_CLASSES = [
  'Personal Accident',
  'Fire',
  'Marine',
  'Travel',
  'Casualty',
  'Property',
  'Engineering',
  'Liability',
  'All Risk',
  'FWIG',
  'FWHS',
  'Medical',
  'Burglary',
  'Plate Glass',
  'Fidelity Guarantee',
] as const;

export type NonMotorClass = (typeof NON_MOTOR_CLASSES)[number];

/** Best-guess class from a product or cover description, for uploads. */
export function inferClassOfBusiness(text: string): NonMotorClass | null {
  const t = text.toLowerCase();
  const rules: [RegExp, NonMotorClass][] = [
    [/personal accident|\bpa\b/, 'Personal Accident'],
    [/fire|houseowner|householder|industrial all risk|consequential/, 'Fire'],
    [/marine|cargo|hull/, 'Marine'],
    [/travel/, 'Travel'],
    [/casualty/, 'Casualty'],
    [/property|business premises/, 'Property'],
    [/engineering|machinery|erection|contractor/, 'Engineering'],
    [/liabilit/, 'Liability'],
    [/all risk/, 'All Risk'],
    [/workmen|foreign worker.*(guarantee|bond)|fwig/, 'FWIG'],
    [/hospitalisation.*(scheme|foreign)|fwhs/, 'FWHS'],
    [/medical|health|hospitalisation/, 'Medical'],
    [/burglar|theft/, 'Burglary'],
    [/plate glass|glass/, 'Plate Glass'],
    [/fidelity/, 'Fidelity Guarantee'],
  ];
  for (const [re, cls] of rules) if (re.test(t)) return cls;
  return null;
}
