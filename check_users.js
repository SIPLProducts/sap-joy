const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envData = fs.readFileSync(envPath, 'utf8');
const envVars = {};
for (const line of envData.split('\n')) {
  if (line.includes('=')) {
    const [key, ...values] = line.split('=');
    envVars[key.trim()] = values.join('=').trim().replace(/"/g, '');
  }
}

const supabase = createClient(envVars['VITE_SUPABASE_URL'], envVars['SUPABASE_SERVICE_ROLE_KEY'], {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  // Check auth.users
  const { data: users, error } = await supabase.auth.admin.listUsers();
  const bala = users.users?.find(u => u.email === 'bala@sharviinfotech.com');
  const adminDemo = users.users?.find(u => u.email === 'admin.demo@hbl.com');
  
  console.log("USERS:", { bala: bala?.email, adminDemo: adminDemo?.email });
  
  if (bala) {
      console.log("Bala DOES exist! Bypassing UI issues, running role assignment...");
      const { error: roleErr } = await supabase.from('user_roles').insert([
          { user_id: bala.id, role: 'admin' }
      ]).select();
      console.log("Role assignment:", roleErr ? roleErr.message : "Success");
  }
}
main();
