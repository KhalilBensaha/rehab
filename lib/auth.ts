import { supabase } from './supabaseClient';

export async function registerAdmin(username: string, password: string, role: 'admin' | 'super_admin') {
  const email = `${username}@rehab.local`;
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // Insert profile with role
  await supabase.from('profiles').insert([{ id: data.user.id, role }]);
  return data;
}

export async function login(identifier: string, password: string) {
  // If identifier looks like an email, use it directly; otherwise, use fake email
  const email = identifier.includes('@') ? identifier : `${identifier}@rehab.local`;
  return supabase.auth.signInWithPassword({ email, password });
}

export async function getUserRole(userId: string) {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (error) throw error;
  return data.role;
}
