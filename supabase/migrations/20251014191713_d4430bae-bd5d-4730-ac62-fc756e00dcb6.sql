-- Corrigir funções adicionando search_path seguro (sem dropar)

CREATE OR REPLACE FUNCTION public.increment_sent_count(campaign_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.message_campaigns
  SET sent_count = sent_count + 1
  WHERE id = campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_failed_count(campaign_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.message_campaigns
  SET failed_count = failed_count + 1
  WHERE id = campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;