export const STRIPE_PRODUCTS = {
  premium: {
    name: 'ComunicaZap Premium',
    price_id: 'price_1SRzrKPFVcRfSdEa6X7WSrTV',
    product_id: 'prod_RsQkGPzGE1u93C',
    price: 'R$ 98,50',
    interval: 'mês',
    features: [
      'Importação automática de contatos do WhatsApp',
      'Pesquisa e filtro avançado de contatos',
      'Envio inteligente com delay de segurança',
      'Histórico completo de campanhas',
      'Templates personalizáveis de mensagens',
      'Suporte prioritário via WhatsApp'
    ]
  }
} as const;

export type ProductKey = keyof typeof STRIPE_PRODUCTS;
