# Chat Giveaway - Documentação de Implementação

## Resumo
Foi criada uma nova funcionalidade completa de **Chat Giveaway** no StreamDrops, permitindo sorteios baseados em mensagens do chat com palavra-chave específica.

## Estrutura Implementada

### 1. Database Layer (`src/database/ChatGiveaway.ts`)
- **ChatGiveawayWinner**: Interface para armazenar dados dos vencedores
  - `id`: ID único do vencedor
  - `name`: Nome de exibição
  - `twitchId`: ID da Twitch
  - `avatar`: URL do avatar
  - `drawnAt`: Data/hora do sorteio

- **ChatGiveawayFormData**: Interface principal do sorteio
  - `id`: ID único do sorteio
  - `title`: Título
  - `description`: Descrição (opcional)
  - `keyword`: Palavra-chave para participação
  - `cost`: Custo em pontos do canal
  - `minimumTier`: Tier mínimo para participar ("free", "1000", "2000", "3000")
  - `subscriberMultiplier`: Multiplicador de sorte por tier
  - `winners`: Array de vencedores
  - `createdAt`: Data de criação
  - `updatedAt`: Data de última atualização

- Funções CRUD completas:
  - `addChatGiveaway`
  - `getChatGiveaways`
  - `getChatGiveaway`
  - `updateChatGiveaway`
  - `deleteChatGiveaway`

### 2. Types (`src/pages/chat-giveaway/types.ts`)
- **ChatGiveawayForm**: Formulário de criação
- **ChatParticipant**: Participante elegível
- **ChatMessage**: Mensagem do chat

### 3. Service Layer (`src/service/chat-giveaway/index.ts`)
- **drawWinner**: Função de sorteio com multiplicador de tier
  - Filtra participantes já sorteados
  - Calcula tickets baseado nos multiplicadores de tier
  - Realiza sorteio aleatório ponderado

### 4. Mock Chat Data (`src/pages/chat-giveaway/hooks/use-mock-chat.ts`)
- **generateMockChatMessages**: Gera mensagens de chat simuladas
- **convertMessageToParticipant**: Converte mensagens que contêm a palavra-chave em participantes
- **filterParticipantsByMinimumTier**: Filtra participantes pelo tier mínimo

### 5. Páginas

#### Página de Listagem (`src/pages/chat-giveaway/index.tsx`)
- Lista todos os chat giveaways criados
- Exibe cards com informações principais
- Botão para criar novo sorteio
- Estado vazio quando não há sorteios

#### Página de Criação (`src/pages/chat-giveaway/create/index.tsx`)
Campos do formulário:
- **Título**: Obrigatório
- **Descrição**: Opcional
- **Palavra-chave**: Obrigatório (ex: !sorteio)
- **Custo**: Pontos do canal necessários
- **Tier mínimo**: Free, Tier 1, 2 ou 3
- **Multiplicadores de sorte**: Por tier (apenas tiers elegíveis)

Após criar, redireciona para a página do sorteio ativo.

#### Página do Sorteio Ativo (`src/pages/chat-giveaway/[id]/index.tsx`)
Layout com 3 colunas:

1. **Participantes** (esquerda):
   - Lista de usuários elegíveis
   - Mostra avatar, nome e tier
   - Contador de participantes

2. **Chat** (centro):
   - Feed de mensagens do chat (mockado)
   - Mostra avatar, nome, tier e mensagem
   - Scroll infinito

3. **Vencedores** (direita):
   - Lista numerada de vencedores
   - Avatar, nome e horário do sorteio
   - Destaque visual especial

**Header**:
- Título e descrição em destaque
- Badges com palavra-chave, tier mínimo e custo
- Botão "Sortear Vencedor" no canto superior direito
  - Animação durante sorteio
  - Notificação toast com nome do vencedor
  - Desabilitado quando não há participantes

### 6. Navegação
- Adicionado item "Chat Giveaway" no sidebar
- Ícone: MessageSquare
- Rotas configuradas:
  - `/dashboard/chat-giveaway` - Lista
  - `/dashboard/chat-giveaway/create` - Criar
  - `/dashboard/chat-giveaway/:id` - Sorteio ativo

### 7. Database Schema
- Adicionada store `chat-giveaways` no IndexedDB
- Versão do banco atualizada para 5

## Funcionalidades

### Criação de Sorteio
1. Preencher formulário com dados do sorteio
2. Definir palavra-chave que participantes devem digitar
3. Escolher tier mínimo de subscriber
4. Configurar multiplicadores de sorte por tier
5. Criar sorteio e ser redirecionado para página ativa

### Durante o Sorteio
1. Chat simulado aparece na coluna central
2. Participantes que digitarem a palavra-chave aparecem na coluna da esquerda
3. Apenas usuários com tier mínimo exigido são elegíveis
4. Streamer clica em "Sortear Vencedor" quantas vezes quiser
5. Sistema usa multiplicadores de sorte para ponderar chances
6. Vencedores aparecem na coluna da direita com horário
7. Notificação visual celebra cada sorteio
8. Participantes já sorteados não são sorteados novamente

### Sistema de Sorte
- Cada tier tem um multiplicador configurável
- Free subscribers têm 1x de chance base
- Tiers pagos podem ter multiplicadores maiores (ex: Tier 1 = 2x, Tier 2 = 3x, Tier 3 = 5x)
- O sorteio é ponderado: mais multiplicador = mais chances

## Componentes UI Adicionados
- `scroll-area`: Para listas roláveis
- `badge`: Para tags e labels

## Próximos Passos (Futuro)
- Integração real com Twitch Chat API
- Sistema de pontos do canal
- Histórico de sorteios
- Exportação de vencedores
- Analytics e estatísticas
- Edição de sorteios ativos

## Tecnologias Utilizadas
- React + TypeScript
- IndexedDB para persistência
- React Hook Form para formulários
- Shadcn/ui para componentes
- Lucide React para ícones
- React Router para navegação
- Sonner para notificações

## Estrutura de Arquivos Criados
```
src/
├── database/
│   └── ChatGiveaway.ts
├── pages/
│   └── chat-giveaway/
│       ├── index.tsx
│       ├── types.ts
│       ├── create/
│       │   └── index.tsx
│       ├── [id]/
│       │   └── index.tsx
│       └── hooks/
│           └── use-mock-chat.ts
└── service/
    └── chat-giveaway/
        └── index.ts
```
