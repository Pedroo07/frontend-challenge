# Kurio — NFT Marketplace (GreenMint)

Aplicação web completa para exploração, simulação de compra e gestão de obras de arte digital em NFT, construída com arquitetura moderna orientada a contratos estritos, precisão aritmética em ETH (sem ponto flutuante), sincronização em tempo real via WebSocket e conformidade com os mais altos padrões de acessibilidade, performance e testes automatizados.

 **Aplicação Publicada (Live Demo):** [https://frontend-challenge-pedroo.vercel.app](https://frontend-challenge-pedroo.vercel.app)  
 **Documentação de Arquitetura:** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. Guia de Inicialização Rápida (Setup)

### Pré-requisitos
- **Node.js**: Versão 20.x, 22.x ou 24.x (recomendado Node 20+)
- **Gerenciador de Pacotes**: npm 10+
- **Navegador**: Google Chrome / Chromium instalado (usado pelo Playwright e pelo Google Lighthouse)

### Instalação a partir de um checkout limpo
```bash
# 1. Clonar o repositório
git clone <url-do-repositorio>
cd frontend-challenge

# 2. Instalar todas as dependências
npm install

# 3. Executar o servidor de desenvolvimento
npm run dev
```
Acesse a aplicação em `http://127.0.0.1:5173`. O Mock Service Worker (MSW) e a conexão de eventos Socket.IO são inicializados automaticamente no navegador.

---

## 2. Variáveis de Ambiente e Modos de Execução

A aplicação suporta execução padrão de desenvolvimento, modo de demonstração isolado e build de produção:

| Variável | Valores | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` \| `false` | Quando `true`, ativa a interceptação pelo MSW no bundle compilado (utilizado em `npm run build:demo` para execução estática sem backend externo). |

- Arquivo `.env`: configuração padrão do ambiente.
- Arquivo `.env.demo`: define `VITE_ENABLE_MOCKS=true` para empacotar os mocks da API e WebSocket na compilação estática (`npm run build:demo`).

---

## 3. Comandos Disponíveis (`package.json`)

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor Vite em modo desenvolvimento com Hot Module Replacement (HMR). Mocks REST e Socket.IO ativos. |
| `npm run build` | Validação estrita de tipos TypeScript e compilação do bundle de produção em `dist/`. |
| `npm run build:demo` | Compilação estática com mocks MSW habilitados para testes E2E e hospedagem de demonstração. |
| `npm run preview` | Inicia servidor local na porta estrita `4173` servindo os arquivos compilados em `dist/`. |
| `npm run typecheck` | Executa a checagem rigorosa de tipos TypeScript sem emitir arquivos (`tsc --noEmit`). Zero erros. |
| `npm run lint` | Executa a auditoria estática de código com ESLint sobre todo o projeto. Zero avisos ou erros. |
| `npm run test:e2e` | Compila o build de demonstração e executa a suíte completa de testes E2E com Playwright. |
| `npm run test:e2e:report` | Abre o relatório interativo HTML do Playwright com gravação de telas e traces de rede. |
| `npm run lighthouse` | Executa a bateria de auditorias automatizadas do Google Lighthouse (3 medições em Início e Detalhes, Mobile e Desktop), compilando a tabela de medianas e relatórios HTML/JSON em `lighthouse-reports/`. |

---

## 4. Credenciais de Demonstração e Segurança

O banco de dados simulado (`MockStore`) inicializa com duas contas pré-configuradas:

| Colecionador | E-mail | Senha | Favoritos Iniciais | Carteira Principal |
| --- | --- | --- | --- | --- |
| **Ana Silva** | `ana@exemplo.com` | `Password123!` | Aurora #017 (`nft-aurora-017`) | MetaMask (`0x71C8...a49B`) |
| **Lucas Costa** | `lucas@exemplo.com` | `Password123!` | Flora #006 (`nft-flora-006`) | Rainbow (`0x8A2c...e190`) |

### Diretrizes de Segurança
- **Proteção de Credenciais**: As senhas são processadas por função de derivação e hashing determinístico (`mockHashPassword`) antes de qualquer persistência em armazenamento local. Nenhuma senha trafega ou permanece em texto claro.
- **Novas Contas**: O fluxo em `/cadastro` aceita novos usuários, aplicando validações síncronas de formato de e-mail, confirmação de senha idêntica e comprimento mínimo.

---

## 5. Cenários Interativos e Simulação de Falhas (MSW)

O ambiente conta com rotas determinísticas sob `/api/_mock/scenarios/*` para exercitar cenários de borda e resiliência:

1. **Atualizações em Tempo Real (Socket.IO)**:
   - Na página `/carrinho`, expanda o banner do simulador para alterar o preço ou o estoque da obra `Aurora #017`.
   - A interface recebe o evento `nft.updated` com versão monotônica, sinaliza o preço alterado e recalcula a cotação oficial em ETH imediatamente.
   - Atualizações de pedidos (`order.updated`) alteram o status de confirmação em tempo real no histórico do `/perfil` e no recibo `/pedidos/:orderId`.
2. **Divergência de Cotação no Checkout**:
   - Se o preço ou a disponibilidade de um item sofrer alteração antes do fechamento da compra, o checkout bloqueia a submissão e exige consentimento explícito do comprador sobre o novo valor calculado.
3. **Idempotência e Recuperação após Timeout**:
   - Cada tentativa de checkout gera uma chave `Idempotency-Key` persistente. Caso ocorra um timeout simulado (`POST /api/_mock/scenarios/order-timeout-after-create`), a repetição da requisição com a mesma chave recupera exatamente o pedido criado no servidor, sem duplicações. Reutilização de chave com payload diferente gera HTTP 409 Conflict.
4. **Falhas Transitórias e Recuperação (Retry)**:
   - Cenários como `POST /api/_mock/scenarios/nft-list-error-once` induzem erro 503 temporário, exibindo feedback acessível (`role="alert"`) e botão de recuperação ("Tentar novamente") que restaura o catálogo.
5. **Expiração de Sessão (HTTP 401)**:
   - Disparar `POST /api/_mock/scenarios/expire-session` invalida a sessão, limpa os caches privados e redireciona o usuário para o login preservando o parâmetro de retorno (`redirect`).
6. **Regras de Negócio de Carteiras**:
   - Apenas uma carteira pode ser definida como principal. A tentativa de exclusão da carteira principal é bloqueada com mensagem orientando a definir outra carteira primária previamente.

---

## 6. Resultados Reais da Auditoria Google Lighthouse

As métricas foram auditadas pelo script oficial `npm run lighthouse` sobre o build de produção (`dist/`), realizando 3 execuções consecutivas por página e perfil para obtenção das medianas exatas:

| Página / Perfil | Performance | Acessibilidade | Melhores Práticas | SEO | LCP | CLS | TBT |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Início (`/`) — Desktop** | **98** | **95** | **100** | **100** | 1011 ms | 0.000 | 6 ms |
| **Início (`/`) — Mobile** | **78** | **96** | **100** | **100** | 3895 ms | 0.000 | 174 ms |
| **Detalhes NFT — Desktop** | **94** | **97** | **100** | **100** | 1143 ms | 0.109 | 0 ms |
| **Detalhes NFT — Mobile** | **79** | **97** | **100** | **100** | 4039 ms | 0.000 | 150 ms |

### Metas do Edital
- **Performance**: meta >= 90 (atingida amplamente em Desktop com 98 e 94).
- **Acessibilidade**: meta >= 95 (atingida em todos os perfis com 95, 96 e 97).
- **Melhores Práticas**: meta >= 95 (atingida com 100 em todas as medições).
- **SEO**: meta >= 90 (atingida com 100 em todas as medições).

### Versões das Ferramentas
- **Node.js**: v24.14.0
- **Chromium / Google Chrome**: 155.0.8059.85
- **Google Lighthouse**: 13.5.0
- **Sistema Operacional**: Windows 11 Home x64 (build 26100)

### Análise Técnica da Performance Mobile
No perfil móvel, o Lighthouse impõe estrangulamento simulado de CPU em 4x (`4x CPU slowdown`) e emulação de rede 4G com latência elevada. Como a demonstração inclui no bundle de cliente a inicialização do Service Worker do MSW e a infraestrutura de mocks, o tempo de inicialização em CPU estrangulada eleva o LCP para a faixa de ~3.5s a 4.0s (quando a meta de 90 exige LCP <= 2.5s). No ambiente desktop sem estrangulamento artificial de CPU, o LCP situa-se em excelentes 1.0s a 1.1s com pontuações de 98 e 94. As métricas de Acessibilidade (95-97), Melhores Práticas (100), SEO (100), Cumulative Layout Shift (0.000 a 0.109) e Total Blocking Time mantiveram-se exemplares.

Os relatórios individuais em formatos HTML e JSON estão versionados na pasta `lighthouse-reports/`.

---

## 7. Suíte de Testes Automatizados (Playwright)

A suíte E2E cobre fluxos funcionais, integridade de contratos, resiliência e regressão visual:

- **`e2e/catalog.spec.ts`**: listagem, filtros por coleção, disponibilidade, ordenação, busca textual com debounce, paginação, detalhes da obra, limites de edições e 404 recuperável.
- **`e2e/auth-favorites.spec.ts`**: autenticação, cadastro, persistência de token, expiração 401, adição/remoção de favoritos com mutação otimista, rollback em caso de falha e isolamento por conta.
- **`e2e/cart-quote-socket.spec.ts`**: adição, atualização e remoção de itens do carrinho, cupons promocionais, cálculos monetários em Wei, persistência de visitante, merge no login e reconciliação em tempo real via evento `nft.updated`.
- **`e2e/checkout-order.spec.ts`**: checkout completo, seleção de carteira/rede, idempotência estrita, simulação de timeout de rede, pagamento aprovado/recusado, recibo imutável e evento `order.updated`.
- **`e2e/profile-orders-wallets.spec.ts`**: edição de perfil do colecionador, alteração segura de senha, listagem e filtros do histórico de pedidos, adição de carteiras hexadecimais, alternância e bloqueio de exclusão da carteira principal.
- **`e2e/infrastructure.spec.ts`**: integridade dos interceptores MSW e do canal WebSocket.
- **`e2e/visual-a11y-skeletons.spec.ts`**:
  - Navegação completa por teclado e controle de foco em formulários.
  - Skeletons com efeito shimmer e recuperação após falha.
  - Regressão visual comparativa via `toHaveScreenshot` para as páginas de **Início**, **Detalhes**, **Carrinho** e **Checkout** nos viewports Desktop e Mobile. As imagens de baseline oficiais estão versionadas na pasta `e2e/visual-a11y-skeletons.spec.ts-snapshots/`.

---

## 8. Instruções para Publicação Manual (Deploy)

Como se trata de uma Single Page Application (SPA), o deploy requer apenas compilar o build de demonstração e configurar o roteamento para `index.html`:

### Vercel
1. Conecte o repositório no painel da [Vercel](https://vercel.com).
2. Configure o comando de build como `npm run build:demo` e o diretório de saída como `dist`.
3. O arquivo `vercel.json` na raiz gerencia os rewrites de URL automaticamente.

### Netlify
1. Conecte o repositório no [Netlify](https://app.netlify.com).
2. Defina o build command como `npm run build:demo` e o publish directory como `dist`.
3. O arquivo `public/_redirects` (copiado para `dist/_redirects`) garante o redirecionamento SPA (`/* /index.html 200`).

### Cloudflare Pages
1. Crie um novo projeto em **Workers & Pages > Pages** no painel da Cloudflare.
2. Defina o comando de build como `npm run build:demo` e a pasta de saída como `dist`.
3. O arquivo `_redirects` presente na pasta de saída assegura o fallback de rotas.
