const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUser() {
  const email = 'aruneshownsty1@gmail.com';
  
  console.log('Checking auth.users...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Auth Error:', authError);
  } else {
    const user = authUsers.users.find(u => u.email === email);
    console.log('User in auth.users:', user ? 'YES (ID: ' + user.id + ')' : 'NO');
  }

  console.log('Checking public.users...');
  const { data: publicUser, error: publicError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();
    
  if (publicError) {
    console.error('Public Error:', publicError);
  } else {
    console.log('User in public.users:', publicUser ? 'YES (Role: ' + publicUser.role + ')' : 'NO');
  }
}

checkUser();
