import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança.
 *
 * A aba do SPED promete ao usuário que a escrituração não sai do navegador. Sem
 * CSP essa promessa dependia apenas de boa fé: qualquer dependência de runtime
 * — ou uma linha de telemetria acrescentada distraidamente — poderia enviar
 * CNPJ, CPF, endereços e valores para fora, e a tela continuaria dizendo que
 * nada é enviado. `connect-src 'self'` transforma a frase num controle técnico:
 * o navegador recusa a requisição.
 *
 * `script-src` ainda precisa de `'unsafe-inline'` porque o layout raiz resolve
 * o tema num script inline antes da primeira pintura, e o bootstrap do Next
 * também é inline; usar nonce exigiria middleware e tiraria as páginas da
 * pré-renderização estática. Em desenvolvimento o Next precisa de `eval` para
 * o HMR. Nada disso enfraquece a garantia acima, que é sobre `connect-src`.
 *
 * `'wasm-unsafe-eval'` é obrigatório: o hash-wasm calcula o SHA-256 do arquivo
 * em WebAssembly, dentro do worker.
 */
const ehDesenvolvimento = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${ehDesenvolvimento ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  /**
   * As rotas passaram a dizer o tributo: /sped virou /icms-ipi e /auditoria
   * virou /pis-cofins. Os nomes antigos não diziam qual escrituração era qual
   * — as duas abas são SPED.
   *
   * O redirect é permanente (308) porque a mudança é definitiva, e existe
   * porque a equipe já tem os links antigos salvos e compartilhados. 308
   * preserva o método da requisição, diferente do 301.
   */
  async redirects() {
    return [
      { source: "/sped", destination: "/icms-ipi", permanent: true },
      { source: "/auditoria", destination: "/pis-cofins", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: "/:caminho*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
