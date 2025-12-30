'use client';

import { supabase } from '@/lib/supabaseClient';
import { Check } from 'lucide-react';
import { useEffect } from 'react';

export default function TestSupabase() {
  useEffect(() => {
    supabase
      .from('companies')
      .select('*')
      .then(({ data, error }) => {
        if (error) {
          console.error('Supabase error:', error);
        } else {
          console.log('Supabase data:', data);
        }
      });
  }, []);

  return <div></div>;
}