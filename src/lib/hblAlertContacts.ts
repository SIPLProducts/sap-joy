/** Official HBL email alert contacts per department (from MRB modification requirements). */
const d = (names: string[]) => names.map(n => `${n}@hbl.in`);

export const HBL_ALERT_CONTACTS: Record<string, string[]> = {
  purchase: d(['anveshreddy.amaravadi', 'subbarao.parsepu', 'rajesh.padamata', 'upender.karra', 'guravaiah.maddigunta', 'manjula.patil', 'sudhakarrs']),
  engineering: d(['prasad.jagatha', 'subrahmanyam.yadavalli', 'ravinderreddy']),
  production: d(['leelarani.ravinuthala', 'kirankumar.gatla', 'rajanikanth.marepally', 'madhu.allam', 'jyothi.syamantha', 'vamshikrishna.komatireddy', 'thalari.penchal', 'durgaprasad.tata']),
  quality: d(['kishore.jakku', 'anand.banoth', 'parasuramudu.kuruva', 'saleem.abdul', 'pratapkumar.nulakala', 'prudhvi.gujja', 'usreenivasu']),
  stores: d(['tmkmechstores', 'satyannarayana.singupuram', 'madhusudhana.kasula']),
};

/** Match a department (role key + display name) to a contact group. */
export function getHblContactsFor(roleKey: string, label = ''): string[] {
  const s = `${roleKey} ${label}`.toLowerCase();
  if (s.includes('store')) return HBL_ALERT_CONTACTS.stores;
  if (s.includes('purchase')) return HBL_ALERT_CONTACTS.purchase;
  if (s.includes('engineer') || s.includes('design')) return HBL_ALERT_CONTACTS.engineering;
  if (s.includes('production') || s.includes('shop_floor') || s.includes('shop floor')) return HBL_ALERT_CONTACTS.production;
  if (s.includes('quality') || /\bqc\b|qc_|_qc|iqc/.test(s)) return HBL_ALERT_CONTACTS.quality;
  return [];
}
