import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é um assistente de suporte especializado na ferramenta ComunicaZap - uma plataforma de envio de mensagens em massa pelo WhatsApp.

FUNCIONALIDADES DA PLATAFORMA:
- Conexão de instância WhatsApp via QR Code
- Importação de contatos via arquivo ou integração N8N
- Criação e gerenciamento de campanhas de mensagens
- Envio de mensagens personalizadas em massa
- Sistema de tags para organizar contatos
- Histórico completo de campanhas
- Calendário de aniversários dos contatos
- Estatísticas de envio e falhas

COMO USAR:
1. Dashboard: Central de controle com estatísticas e acesso rápido
2. Conectar WhatsApp: Escanear QR Code para conectar sua conta
3. Importar Contatos: Upload de arquivo Excel/CSV ou integração via N8N
4. Nova Campanha: Selecionar contatos, personalizar mensagem, enviar
5. Histórico: Acompanhar todas as campanhas anteriores
6. Calendário: Ver aniversariantes e programar mensagens

ASSINATURA:
- Período de teste gratuito disponível
- Plano Premium para envios ilimitados
- Gerenciar assinatura via portal do cliente

Responda de forma clara, objetiva e amigável. Forneça exemplos práticos quando relevante.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o suporte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Erro no gateway de IA:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao processar mensagem" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Erro no chat de suporte:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
