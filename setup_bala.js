const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env manually
const envPath = path.join(__dirname, '.env');
const envData = fs.readFileSync(envPath, 'utf8');
const envLines = envData.split('\n');
const envVars = {};
for (const line of envLines) {
  if (line.includes('=')) {
    const [key, ...values] = line.split('=');
    envVars[key.trim()] = values.join('=').trim().replace(/"/g, '');
  }
}

const supabaseUrl = envVars['VITE_SUPABASE_URL'] || 'http://10.10.4.178:8000';
const supabaseServiceKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseServiceKey) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY not found in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function recreateAdmin() {
  console.log("🚀 Connecting to Supabase GoTrue API to build Bala smoothly...");
  const email = "bala@sharviinfotech.com";

  console.log(`First securely fetching users via Admin API...`);
  try {
    const target = await supabase.from('profiles').select('user_id').eq('email', email).single();
    if (target.data) {
        console.log(`🧼 Cleaning up previous ID ${target.data.user_id}...`);
        await supabase.auth.admin.deleteUser(target.data.user_id);
    }
  } catch(e) { }

  console.log(`✨ Creating pure ${email} with password '123456'...`);
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "123456",
    email_confirm: true,
    user_metadata: {
      full_name: "Bala System Admin",
      role: "admin",
      plant: "1300"
    }
  });

  if (error) {
    console.error("❌ Error creating via GoTrue API:", error.message);
  } else {
    console.log(`✅ SUCCESS! ${email} PERFECTLY created via official API!`);
  }
}

recreateAdmin();
