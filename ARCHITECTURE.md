# Arquitetura inicial

Esta etapa prepara a fundação executável e uma tela temporária de diagnóstico. O `README.md` original do desafio permanece preservado. Catálogo, autenticação, carrinho, pedidos e demais fluxos de negócio ainda não foram implementados.

## Stack e responsabilidades

- React e TypeScript estrito: interface e contratos do diagnóstico.
- Vite: servidor de desenvolvimento e build de produção.
- TanStack Router: instância em `src/lib/router.ts`, rotas baseadas em arquivos; o plugin Vite gera `src/routeTree.gen.ts`.
- TanStack Query: estado da consulta de saúde, com cliente centralizado em `src/lib/query-client.ts`.
- Axios: chamadas HTTP por uma instância compartilhada em `src/lib/http.ts`.
- Tailwind CSS v4: estilos pelo plugin oficial do Vite.
- shadcn/ui: configuração em `components.json` e componente Card em `src/components/ui/card.tsx`.
- MSW 2: interceptação no navegador para HTTP e WebSocket.
- `socket.io-client` e `@mswjs/socket.io-binding`: prova de transporte Socket.IO sobre WebSocket.
- Playwright: primeiro teste E2E usando Chromium.

As versões exatas resolvidas estão registradas no `package-lock.json`.

## Iniciar

```sh
npm install
npm run dev
```

O desenvolvimento inicia o MSW automaticamente. `npm run build:demo` gera um build com mocks habilitados e `npm run preview` o serve localmente. `npm run build` verifica tipos e gera o build de produção sem habilitar os mocks. `npm run test:e2e` prepara o build de demonstração, inicia o preview para o teste e encerra o servidor ao terminar. Para checks: `npm run typecheck`, `npm run lint` e `npm run test:e2e`.

## REST e inicialização do MSW

`src/main.tsx` aguarda `startBrowserMocks()` antes de montar a aplicação. O worker é ativado no desenvolvimento e quando `VITE_ENABLE_MOCKS=true`, inclusive no modo `demo`. Requisições HTTP sob `/api/` sem handler são reportadas como erro pelo MSW; requisições alheias à API simulada (por exemplo, os assets do Vite) seguem normalmente.

A página usa TanStack Query para solicitar `GET /api/health`, o query function usa Axios e o handler em `src/mocks/rest-handlers.ts` devolve um contrato `HealthResponse` tipado. Não existe resposta fictícia no componente nem sucesso substituto em caso de falha.

## Socket.IO de demonstração

O cliente conecta à origem atual com `path: '/socket.io'` e `transports: ['websocket']`. O handler MSW separado em `src/mocks/socket-handlers.ts` é registrado pela mesma origem usando `ws.link(...)`; o MSW remove o prefixo padrão `/socket.io/` antes de comparar a URL. `toSocketIo(connection)` do pacote instalado realiza a codificação e decodificação do protocolo. Ao interceptar a conexão, o handler emite `nft.updated` pelo lado do cliente conectado. O cliente socket.io recebe o evento e o exibe junto com `nftId`, preço ETH em string, disponibilidade e versão.

O efeito do React trata `connect`, `disconnect`, `connect_error` e `nft.updated`; ao desmontar, remove cada listener e encerra o socket.

Limitações conhecidas do binding: suporta o namespace padrão e eventos textuais; acknowledgements, namespaces personalizados e anexos binários não são cobertos. Esta prova não implementa reconexão ou sincronização do catálogo. O servidor simulado emite um evento determinístico por conexão.

## Política de cache e próximos requisitos

O QueryClient usa `staleTime` de 30 segundos, uma tentativa de retry e não refaz consultas ao recuperar foco, apropriado para o diagnóstico. A política deve ser revisitada para catálogo, sessão e recursos do usuário. Não há estado remoto em Context/store.

Ainda faltam catálogo/detalhe, parâmetros de URL e filtros, fixtures e cenários extensos, sessão/conta, favoritos, carrinho, cotação, pedidos idempotentes, atualizações otimistas, eventos `order.updated`, reconciliação após reconexão, responsividade alinhada ao Figma, testes E2E dos fluxos, regressão visual e auditoria Lighthouse. O deploy público também continua pendente.
