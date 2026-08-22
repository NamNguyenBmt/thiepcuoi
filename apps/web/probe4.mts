process.env.PGLITE_DIR = '.data/pg';
const { getInviteBySlug } = await import('./lib/db');
const inv = (await getInviteBySlug('quan-lan'))!;

function moTa(v: unknown, path = ''): string[] {
  const out: string[] = [];
  if (v && typeof v === 'object') {
    const ctor = v.constructor?.name;
    if (ctor !== 'Object' && ctor !== 'Array') out.push(`${path || '<root>'}: ${ctor}`);
    for (const [k, val] of Object.entries(v)) out.push(...moTa(val, path ? `${path}.${k}` : k));
  }
  return out;
}
console.log('kieu la trong invite.data:', moTa(inv.data).join(', ') || '(khong co)');
console.log('kieu la trong ca hang    :', moTa(inv).join(', ') || '(khong co)');
console.log('data.groom.shortName     :', JSON.stringify(inv.data.groom.shortName));
console.log('prototype cua data       :', Object.getPrototypeOf(inv.data)?.constructor?.name);
console.log('co the JSON.stringify    :', JSON.stringify(inv.data).length, 'ky tu');
