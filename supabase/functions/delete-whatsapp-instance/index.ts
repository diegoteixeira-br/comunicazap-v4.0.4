import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Deleting instance for user:', user.id);

    // Get instance details
    const { data: instance, error: instanceError } = await supabaseClient
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (instanceError || !instance) {
      throw new Error('No WhatsApp instance found');
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL') ?? '';
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY') ?? '';

    // Try to logout from Evolution API first
    try {
      console.log(`Attempting to logout instance: ${instance.instance_name}`);
      const logoutResponse = await fetch(`${evolutionApiUrl}/instance/logout/${instance.instance_name}`, {
        method: 'DELETE',
        headers: {
          'apikey': evolutionApiKey
        }
      });

      if (logoutResponse.ok) {
        console.log('Instance logged out from Evolution API');
      } else {
        const errorText = await logoutResponse.text();
        console.warn('Failed to logout from Evolution API:', errorText);
      }
    } catch (error) {
      console.error('Evolution API logout error:', error);
    }

    // Now delete the instance
    try {
      console.log(`Attempting to delete instance: ${instance.instance_name}`);
      const deleteResponse = await fetch(`${evolutionApiUrl}/instance/delete/${instance.instance_name}`, {
        method: 'DELETE',
        headers: {
          'apikey': evolutionApiKey
        }
      });

      if (deleteResponse.ok) {
        const deleteData = await deleteResponse.json();
        console.log('Instance deleted from Evolution API:', deleteData);
      } else {
        const errorText = await deleteResponse.text();
        console.warn('Failed to delete from Evolution API:', errorText);
      }
    } catch (error) {
      console.error('Evolution API deletion error:', error);
    }

    // Delete from database
    const { error: deleteError } = await supabaseClient
      .from('whatsapp_instances')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Database deletion error:', deleteError);
      throw deleteError;
    }

    console.log('Instance deleted successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'WhatsApp disconnected successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
