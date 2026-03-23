

## Fix: Edge Function Deployment on Self-Hosted Supabase (10.10.4.178)

### Problem 1: Permission Denied
You need `sudo` to write files in `/opt/supabase/docker/volumes/functions/`.

### Problem 2: 401 Unauthorized
Edge functions in self-hosted Supabase require the `SERVICE_ROLE_KEY` or valid `ANON_KEY` in the Authorization header.

---

### Step-by-Step Commands (Run in PuTTY)

#### 1. Create directories with proper permissions

```bash
sudo mkdir -p /opt/supabase/docker/volumes/functions/create-user
sudo mkdir -p /opt/supabase/docker/volumes/functions/sap-sync
sudo mkdir -p /opt/supabase/docker/volumes/functions/seed-demo-users
sudo mkdir -p /opt/supabase/docker/volumes/functions/send-mrb-email
sudo chmod -R 777 /opt/supabase/docker/volumes/functions/
```

#### 2. Write the create-user function

```bash
sudo tee /opt/supabase/docker/volumes/functions/create-user/index.ts > /dev/null << 'FUNC_EOF'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: authError } = await anonClient.auth.getUser();
    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await anonClient.from("user_roles").select("role").eq("user_id", callingUser.id).maybeSingle();
    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can create users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, full_name, role, department, plant } = await req.json();

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    await adminClient.from("profiles").update({
      department: department || null,
      plant: plant || null,
    }).eq("user_id", userId);

    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: userId,
      role,
    });

    if (roleError) {
      console.error("Role assignment error:", roleError);
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId, message: "User " + email + " created successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
FUNC_EOF
```

#### 3. Write the seed-demo-users function

```bash
sudo tee /opt/supabase/docker/volumes/functions/seed-demo-users/index.ts > /dev/null << 'FUNC_EOF'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const demoUsers = [
  { email: "admin@plant1300.com", password: "Test@123", fullName: "Admin User", role: "admin" },
  { email: "quality@plant1300.com", password: "Test@123", fullName: "Quality Inspector", role: "quality" },
  { email: "qualityhead@plant1300.com", password: "Test@123", fullName: "Quality Head", role: "quality_head" },
  { email: "purchase@plant1300.com", password: "Test@123", fullName: "Purchase Team", role: "purchase" },
  { email: "purchasehead@plant1300.com", password: "Test@123", fullName: "Purchase Head", role: "purchase_head" },
  { email: "engineering@plant1300.com", password: "Test@123", fullName: "Engineering Team", role: "engineering" },
  { email: "enghead@plant1300.com", password: "Test@123", fullName: "Engineering Head", role: "engineering_head" },
  { email: "shopfloor@plant1300.com", password: "Test@123", fullName: "Shop Floor User", role: "shop_floor" },
  { email: "executive@plant1300.com", password: "Test@123", fullName: "Executive Manager", role: "executive" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const results = [];

    for (const demoUser of demoUsers) {
      try {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const userExists = existingUsers?.users?.some(u => u.email === demoUser.email);

        if (userExists) {
          results.push({ email: demoUser.email, status: "already_exists" });
          continue;
        }

        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: demoUser.email,
          password: demoUser.password,
          email_confirm: true,
          user_metadata: { full_name: demoUser.fullName },
        });

        if (createError) {
          results.push({ email: demoUser.email, status: "error", error: createError.message });
          continue;
        }

        if (userData.user) {
          // Update profile with plant
          await supabaseAdmin.from("profiles").update({
            plant: "1300",
            department: demoUser.role,
          }).eq("user_id", userData.user.id);

          const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
            user_id: userData.user.id,
            role: demoUser.role,
          });

          results.push({
            email: demoUser.email,
            status: roleError ? "created_no_role" : "created",
            error: roleError?.message,
          });
        }
      } catch (userError) {
        results.push({ email: demoUser.email, status: "error", error: String(userError) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Demo users seeding completed", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
FUNC_EOF
```

#### 4. Write the send-mrb-email function

```bash
sudo tee /opt/supabase/docker/volumes/functions/send-mrb-email/index.ts > /dev/null << 'FUNC_EOF'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mrb_id, event_type, triggered_by } = await req.json();

    const { data: mrb, error: mrbError } = await supabase
      .from("mrb_records")
      .select("*")
      .eq("id", mrb_id)
      .single();

    if (mrbError || !mrb) {
      return new Response(JSON.stringify({ error: "MRB not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", event_type)
      .eq("is_active", true)
      .or("plant.is.null,plant.eq." + mrb.plant)
      .order("plant", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!template) {
      return new Response(JSON.stringify({ error: "No active template found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipients = [];
    if (mrb.pending_with) {
      const { data: roleUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", mrb.pending_with);

      if (roleUsers) {
        const userIds = roleUsers.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email, plant")
          .in("user_id", userIds);

        if (profiles) {
          profiles
            .filter(p => p.plant === mrb.plant || !p.plant)
            .forEach(p => recipients.push(p.email));
        }
      }
    }

    const replacePlaceholders = (text) => {
      return text
        .replace(/\{\{mrb_number\}\}/g, mrb.mrb_number)
        .replace(/\{\{material_description\}\}/g, mrb.material_description)
        .replace(/\{\{plant\}\}/g, mrb.plant)
        .replace(/\{\{pending_with\}\}/g, mrb.pending_with || "")
        .replace(/\{\{final_decision\}\}/g, mrb.final_decision || "")
        .replace(/\{\{pending_days\}\}/g, String(mrb.pending_days || 0));
    };

    const subject = replacePlaceholders(template.subject_template);
    const body = replacePlaceholders(template.body_template);

    await supabase.from("email_logs").insert({
      mrb_id: mrb.id,
      mrb_number: mrb.mrb_number,
      subject,
      body,
      recipients: recipients.length > 0 ? recipients : ["system@hbl.com"],
      template: event_type,
      sent_by: triggered_by || mrb.created_by,
      status: "logged",
    });

    return new Response(JSON.stringify({ success: true, subject, recipients }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
FUNC_EOF
```

#### 5. Configure Edge Functions in Docker

Check your `docker-compose.yml` for the functions service:

```bash
sudo cat /opt/supabase/docker/docker-compose.yml | grep -A 20 "functions:"
```

If no `functions` service exists, add it:

```bash
sudo nano /opt/supabase/docker/docker-compose.yml
```

Add this service block (after the `auth` service):

```yaml
  functions:
    container_name: supabase-edge-functions
    image: supabase/edge-runtime:v1.65.3
    restart: unless-stopped
    depends_on:
      analytics:
        condition: service_healthy
    environment:
      SUPABASE_URL: http://kong:8000
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY}
      SUPABASE_DB_URL: postgresql://supabase_functions_admin:${POSTGRES_PASSWORD}@db:5432/postgres
      VERIFY_JWT: "false"
    volumes:
      - ./volumes/functions:/home/deno/functions:Z
    command:
      - start
      - --main-service
      - /home/deno/functions/main
```

#### 6. Create the main entry point

```bash
sudo mkdir -p /opt/supabase/docker/volumes/functions/main
sudo tee /opt/supabase/docker/volumes/functions/main/index.ts > /dev/null << 'FUNC_EOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const functionName = pathParts[pathParts.length - 1];

  if (!functionName || functionName === "main") {
    return new Response(JSON.stringify({ status: "Edge Functions running" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const module = await import(`../${functionName}/index.ts`);
    return module.default ? module.default(req) : new Response("Function has no default export", { status: 500 });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Function not found: " + functionName }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
});
FUNC_EOF
```

#### 7. Update Kong routing

```bash
sudo nano /opt/supabase/docker/volumes/api/kong.yml
```

Add under `services:`:

```yaml
  - name: functions
    url: http://functions:9000
    routes:
      - name: functions-v1-all
        strip_path: true
        paths:
          - /functions/v1/
    plugins:
      - name: cors
```

#### 8. Restart everything

```bash
cd /opt/supabase/docker
sudo docker compose down
sudo docker compose up -d
```

Wait 30 seconds, then verify:

```bash
sudo docker ps | grep functions
```

#### 9. Test the functions

```bash
# Get your SERVICE_ROLE_KEY
grep SERVICE_ROLE_KEY /opt/supabase/docker/.env

# Test seed-demo-users (creates all users at once)
curl -X POST http://10.10.4.178:8000/functions/v1/seed-demo-users \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Test create-user (requires admin token - use after admin is created)
# First login as admin to get a token:
curl -X POST http://10.10.4.178:8000/auth/v1/token?grant_type=password \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@plant1300.com","password":"Test@123"}'

# Then use the access_token from above:
curl -X POST http://10.10.4.178:8000/functions/v1/create-user \
  -H "Authorization: Bearer ACCESS_TOKEN_FROM_LOGIN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@plant1300.com","password":"Test@123","full_name":"Test User","role":"quality","plant":"1300"}'
```

### Troubleshooting

| Issue | Fix |
|-------|-----|
| Permission denied | Use `sudo` for all file operations |
| 401 Unauthorized | Use `SERVICE_ROLE_KEY` for seed functions, or valid user token for create-user |
| Function not found | Check `docker logs supabase-edge-functions` for errors |
| Container not starting | Run `sudo docker logs supabase-edge-functions` to see startup errors |

