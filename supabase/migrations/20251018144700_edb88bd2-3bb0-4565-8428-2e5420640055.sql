-- Habilitar realtime para as tabelas necessárias
ALTER TABLE public.message_logs REPLICA IDENTITY FULL;
ALTER TABLE public.message_campaigns REPLICA IDENTITY FULL;

-- Adicionar as tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_campaigns;