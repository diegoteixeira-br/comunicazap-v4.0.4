import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  
  if (!stripeKey || !webhookSecret) {
    logStep("ERROR", { message: "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET" });
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    logStep("ERROR", { message: "Missing stripe-signature header" });
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let event: Stripe.Event;
  const body = await req.text();

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    logStep("Event received", { type: event.type, id: event.id });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logStep("ERROR: Webhook signature verification failed", { message: errorMessage });
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Only process invoice.payment_succeeded events
  if (event.type !== "invoice.payment_succeeded") {
    logStep("Ignoring event type", { type: event.type });
    return new Response(JSON.stringify({ received: true, processed: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const invoice = event.data.object as Stripe.Invoice;
  const customerEmail = invoice.customer_email;

  if (!customerEmail) {
    logStep("No customer email in invoice", { invoiceId: invoice.id });
    return new Response(JSON.stringify({ received: true, processed: false, reason: "no_email" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  logStep("Processing payment for", { email: customerEmail, invoiceId: invoice.id });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Find the user by email
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, referred_by_code, email")
      .eq("email", customerEmail)
      .maybeSingle();

    if (profileError) {
      logStep("ERROR: Failed to fetch profile", { error: profileError.message });
      return new Response(JSON.stringify({ received: true, error: profileError.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile) {
      logStep("No profile found for email", { email: customerEmail });
      return new Response(JSON.stringify({ received: true, processed: false, reason: "no_profile" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Found profile", { userId: profile.id, referredByCode: profile.referred_by_code });

    // Check if user was referred and referral bonus hasn't been applied yet
    if (!profile.referred_by_code) {
      logStep("User has no referral code, skipping bonus");
      return new Response(JSON.stringify({ received: true, processed: true, bonus_applied: false, reason: "no_referral" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if referral exists and hasn't been rewarded
    const { data: referral, error: referralError } = await supabaseClient
      .from("referrals")
      .select("*")
      .eq("referred_user_id", profile.id)
      .maybeSingle();

    if (referralError) {
      logStep("ERROR: Failed to fetch referral", { error: referralError.message });
      return new Response(JSON.stringify({ received: true, error: referralError.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!referral) {
      logStep("No referral record found for user", { userId: profile.id });
      return new Response(JSON.stringify({ received: true, processed: true, bonus_applied: false, reason: "no_referral_record" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check idempotency - if already rewarded, skip
    if (referral.status === "rewarded") {
      logStep("Referral already rewarded, skipping", { referralId: referral.id });
      return new Response(JSON.stringify({ received: true, processed: true, bonus_applied: false, reason: "already_rewarded" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply the referral bonus using the database function
    logStep("Applying referral bonus", { referredUserId: profile.id, referrerId: referral.referrer_user_id });

    const { data: bonusResult, error: bonusError } = await supabaseClient
      .rpc("apply_referral_bonus", { p_referred_user_id: profile.id });

    if (bonusError) {
      logStep("ERROR: Failed to apply bonus", { error: bonusError.message });
      return new Response(JSON.stringify({ received: true, error: bonusError.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Referral bonus applied successfully", { result: bonusResult });

    return new Response(JSON.stringify({ 
      received: true, 
      processed: true, 
      bonus_applied: true,
      result: bonusResult 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Unexpected error", { message: errorMessage });
    return new Response(JSON.stringify({ received: true, error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
