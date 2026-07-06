import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vsdmoezxxqzoxvzzevmm.supabase.co';
const supabaseKey = 'sb_publishable_Uh1n_W8aCP93J3mMTswjhw_btUWmxqx';

export const supabase = createClient(supabaseUrl, supabaseKey);
