# Arquitetura do NFT Marketplace — GreenMint / Kurio

O `README.md` original do desafio permanece preservado. Este documento detalha a arquitetura, as decisões técnicas, os contratos da API simulada, o gerenciamento de sessão, o isolamento de cache e os testes E2E.

## 1. Stack e responsabilidades

- **React 19 e TypeScript estrito**: interface tipada e contratos rigorosos da camada de apresentação e da API simulada.
- **Vite 8**: servidor de desenvolvimento e build de produção com compilação rápida.
- **TanStack Router 1**: roteamento declarativo e tipado em `src/lib/router.ts`. As rotas são baseadas em arquivos em `src/routes/` e o plugin Vite gera `src/routeTree.gen.ts`.
- **TanStack Query 5**: gerenciamento de estado remoto, cache, mutações otimistas com rollback e isolamento de consultas em `src/lib/query-client.ts`.
- **Axios 1**: cliente HTTP compartilhado em `src/lib/http.ts`, configurado com interceptors para injeção automática de tokens e tratamento de expiração de sessão.
- **Tailwind CSS v4**: estilos atômicos e tokens transcritos da especificação visual.
- **shadcn/ui**: primitivos acessíveis e componentes base.
- **MSW 2 (Mock Service Worker)**: interceptação em nível de rede no navegador para HTTP REST e eventos Socket.IO.
- **Playwright 1**: suíte de testes E2E cobrindo fluxos felizes, cenários determinísticos de erro e responsividade em múltiplos viewports.

## 2. Inicialização e comandos

```sh
npm install
npm run dev
```

- `npm run dev`: inicia a aplicação em modo desenvolvimento com MSW ativado automaticamente.
- `npm run build:demo`: compila a aplicação com mocks habilitados para demonstração e testes E2E.
- `npm run preview`: serve localmente o build de demonstração em `http://127.0.0.1:4173`.
- `npm run build`: gera o build de produção sem mocks.
- `npm run test:e2e`: executa a compilação de demonstração, inicializa o preview e roda a suíte Playwright completa (23 testes determinísticos).
- `npm run typecheck`: validação estrita de tipos TypeScript sem emitir arquivos.
- `npm run lint`: verificação de estilo e boas práticas com ESLint.

## 3. Autenticação e ciclo de vida da sessão

### Gerenciamento de sessão e persistência

A aplicação não considera o usuário autenticado por meras flags em memória. A existência e validade da sessão são confirmadas junto à API mockada por meio de `GET /api/auth/session`:

- **Armazenamento seguro de credenciais**: apenas o token de autenticação simulado opaco (`nft_auth_token`) é mantido em `localStorage`. Nenhuma senha é armazenada em texto claro no navegador.
- **Injeção do token**: o interceptor de requisição em `src/lib/http.ts` anexa o header `Authorization: Bearer <token>` em todas as chamadas HTTP.
- **Sobrevivência a refresh**: na inicialização ou após recarregar a página, o `AuthProvider` (`src/lib/auth-context.tsx`) executa a consulta `['auth', 'session']`. Caso o token seja válido, o usuário é restaurado; se for inválido ou ausente, a sessão é encerrada.
- **Expiração de sessão**: caso qualquer requisição retorne `HTTP 401` com `{ message: 'Sessão expirada.' }`, o interceptor de resposta dispara um evento customizado que limpa o token, remove o cache privado e redireciona o usuário para `/login?redirect=<url_atual>`, preservando o contexto para retorno pós-login.
- **Logout e troca de usuário**: o encerramento da sessão executa `POST /api/auth/logout`, remove o token do armazenamento local e invalida seletivamente as consultas privadas via `queryClient.removeQueries({ queryKey: ['favorites'] })` e `queryClient.removeQueries({ queryKey: ['account'] })`, definindo a sessão como `null` via `setQueryData(['auth', 'session'], null)` para preservar os observers ativos e garantir a transição imediata da interface sem vazamento de dados entre contas.

### Contas de demonstração pré-configuradas

- `ana@exemplo.com` / `Password123!` (Nome: Ana Silva, favoritos iniciais: `['nft-aurora-017']`)
- `lucas@exemplo.com` / `Password123!` (Nome: Lucas Costa, favoritos iniciais: `['nft-flora-006']`)

## 4. Favoritos integrados à API e política de cache

A gestão de favoritos foi desacoplada de estados voláteis de componente e integrada diretamente ao backend simulado:

- **Isolamento por identidade**: a query key utilizada é `['favorites', user?.id]`. Como a chave inclui o identificador único do usuário ativo, contas distintas possuem partições de cache estritamente separadas.
- **Mutação otimista com rollback**:
  1. No disparo de inclusão ou remoção (`useFavorites`), o `onMutate` cancela consultas em andamento para a chave do usuário e grava um snapshot do estado anterior.
  2. A interface é atualizada imediatamente no cache local para sensação de resposta instantânea.
  3. Caso a API retorne erro (ex.: falha 500 simulada), o `onError` restaura o snapshot anterior, impedindo que a interface permaneça em estado inconsistente, e expõe mensagem acessível de alerta.
  4. O `onSettled` revalida a consulta para garantir sincronia final com o mock store.
- **Prevenção de concorrência**: cliques repetidos no mesmo item durante uma mutação pendente são ignorados até a conclusão da operação.
- **Usuários não autenticados**: tentativas de favoritar uma obra sem login ativo redirecionam automaticamente para `/login?redirect=<origem>`.

## 5. Contratos REST e endpoints simulados

### Sessão e autenticação

| Método | Rota | Descrição | Resposta de sucesso | Erros previstos |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Criação de conta | `201 Created`: `{ user, token }` | `400`: dados inválidos; `409`: e-mail já cadastrado |
| `POST` | `/api/auth/login` | Autenticação por credenciais | `200 OK`: `{ user, token }` | `400`: campos vazios; `401`: credenciais inválidas |
| `GET` | `/api/auth/session` | Validação da sessão ativa | `200 OK`: `{ user }` | `401`: token ausente, inválido ou expirado |
| `POST` | `/api/auth/logout` | Encerramento da sessão | `200 OK`: `{ success: true }` | - |
| `GET` | `/api/account` | Dados cadastrais do usuário | `200 OK`: `{ user }` | `401`: sessão inválida ou expirada |

### Catálogo e obras

| Método | Rota | Descrição | Resposta de sucesso | Erros previstos |
| --- | --- | --- | --- | --- |
| `GET` | `/api/nfts` | Listagem com busca, filtros, ordenação e paginação | `200 OK`: `{ items, total, page, pageSize, totalPages }` | `503`: erro transitório configurado por cenário |
| `GET` | `/api/nfts/:nftId` | Detalhes completos do NFT | `200 OK`: `Nft` | `404`: obra não encontrada |

### Favoritos

| Método | Rota | Descrição | Resposta de sucesso | Erros previstos |
| --- | --- | --- | --- | --- |
| `GET` | `/api/favorites` | Lista IDs favoritados pelo usuário autenticado | `200 OK`: `{ items: string[] }` | `401`: não autenticado / sessão expirada |
| `POST` | `/api/favorites` | Adiciona um NFT aos favoritos | `200 OK`: `{ success: true, nftId, items }` | `401`: não autorizado; `500`: falha de mutation |
| `DELETE` | `/api/favorites/:nftId` | Remove um NFT dos favoritos | `200 OK`: `{ success: true, nftId, items }` | `401`: não autorizado; `500`: falha de mutation |

### Controle determinístico de cenários (MSW)

- `POST /api/_mock/scenarios/reset`: restaura o estado padrão do mock store (usuários padrão, sessões e favoritos).
- `POST /api/_mock/scenarios/expire-session`: força a próxima validação de sessão ou operação protegida a falhar com HTTP 401 (`Sessão expirada.`).
- `POST /api/_mock/scenarios/favorites-fail-once`: induz falha HTTP 500 na próxima operação de adição/remoção de favorito para exercitar o rollback da UI.
- `POST /api/_mock/scenarios/nft-list-error-once`: induz falha HTTP 503 na próxima consulta ao catálogo para testar a recuperação da listagem.

## 6. Telas implementadas nesta etapa

- **`/login`**:
  - Formulário com campos de e-mail e senha, validação de formato e tratamento de credenciais inválidas com `role="alert"`.
  - Botão de envio com feedback de estado de carregamento (`isSubmitting`).
  - Preservação do parâmetro `redirect` para retorno transparente à rota de origem.
  - Seletor rápido de contas de demonstração (`ana@exemplo.com` / `lucas@exemplo.com`).
  - Navegação completa por teclado, contraste adequado e foco visível.
- **`/cadastro`**:
  - Campos para nome completo, e-mail, senha (mínimo 6 caracteres) e confirmação de senha com validação em tempo real.
  - Tratamento de conflito de cadastro (`HTTP 409: E-mail já cadastrado`).
  - Redirecionamento com preservação do parâmetro de destino.
- **Integração no Catálogo (`/`) e Detalhes (`/nfts/$nftId`)**:
  - Cards do catálogo e página de detalhe contam com botões acessíveis de favorito (`aria-pressed`, labels dinâmicos e prevenção de clique concorrente).
  - Feedback visual de rollback em caso de recusa da API.
- **Cabeçalho (`MarketplaceHeader`)**:
  - Exibição condicional: botão "Entrar" direcionando ao login para visitantes; exibição do nome do colecionador e botão de "Sair" para usuários autenticados.
  - Suporte completo às versões desktop e mobile navigation bar.

## 7. Cobertura de testes E2E (Playwright)

A suíte em `e2e/auth-favorites.spec.ts` cobre todos os requisitos da Etapa 3:

1. Login bem-sucedido e atualização do cabeçalho.
2. Login com credenciais inválidas e mensagem de erro.
3. Cadastro válido e autenticação imediata.
4. Cadastro com e-mail duplicado e tratamento de conflito 409.
5. Persistência da sessão após recarregamento da página (`page.reload()`).
6. Expiração forçada de sessão e retorno à rota anterior após novo login.
7. Adição de favorito associada ao usuário autenticado.
8. Remoção de favorito e atualização da interface e API.
9. Persistência dos favoritos após atualização da página.
10. Rollback da interface em caso de falha transitória da API de favoritos.
11. Logout e limpeza de estado privado.
12. Troca de usuário sem vazamento de favoritos ou dados privados entre contas.
13. Responsividade em 390px, 768px e 1440px sem overflow horizontal nas novas telas.

Os testes anteriores de diagnóstico (`e2e/diagnostic.spec.ts`) e catálogo/detalhes (`e2e/catalog.spec.ts`) continuam integralmente preservados e aprovados, totalizando 23 testes automatizados.

## 8. Limitações da simulação e próximos passos

- **Limitações do binding MSW Socket.IO**: o transporte opera sobre WebSocket simulado suportando eventos textuais (`nft.updated`).
- **Próximas etapas recomendadas**:
  - Etapa 4: Carrinho de compras com persistência local/sessão, cálculo de cotação em ETH com cupons e atualização em tempo real via Socket.IO.
  - Etapa 5: Checkout, seleção de carteira/rede, idempotência de pedidos e recibo de confirmação.
