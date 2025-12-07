import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============= SECURITY: Validate webhook secret =============
    const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('N8N_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { campaign_id, status, sent_count, failed_count, secret } = body;

    // Validate secret token
    if (secret !== webhookSecret) {
      console.error('Invalid webhook secret provided');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Received update-campaign-status request:', { campaign_id, status, sent_count, failed_count });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate required fields
    if (!campaign_id) {
      console.error('Missing campaign_id');
      return new Response(
        JSON.stringify({ success: false, error: 'campaign_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!status) {
      console.error('Missing status');
      return new Response(
        JSON.stringify({ success: false, error: 'status é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      status: status,
    };

    // Add completed_at if status is completed
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    // Add counts if provided
    if (typeof sent_count === 'number') {
      updateData.sent_count = sent_count;
    }

    if (typeof failed_count === 'number') {
      updateData.failed_count = failed_count;
    }

    console.log('Updating campaign with data:', updateData);

    // Update the campaign
    const { data, error } = await supabase
      .from('message_campaigns')
      .update(updateData)
      .eq('id', campaign_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating campaign:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Campaign updated successfully:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Status atualizado com sucesso',
        campaign_id: campaign_id,
        new_status: status,
        data: data
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
