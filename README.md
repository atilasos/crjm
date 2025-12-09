# Jogos Matemáticos - CRJM

Site de treino para o **Campeonato Regional de Jogos Matemáticos da Madeira** (CRJM).

Este projeto contém os 3 jogos do **1.º Ciclo**:
- 🐱🐶 **Gatos & Cães** - Jogo de estratégia onde gatos tentam bloquear o cão
- 🁓 **Dominório** - Coloca dominós estrategicamente no tabuleiro
- ⬡ **Quelhas** - Move peças numeradas para conquistar o território adversário

## 🎮 Funcionalidades

- Jogar contra o **computador** (IA)
- Jogar com **2 jogadores** no mesmo computador
- Regras oficiais do CRJM
- Interface em **Português de Portugal** (PT-PT)
- Totalmente responsivo (funciona em computador e tablet)

## 🚀 Começar

### Pré-requisitos

- [Bun](https://bun.sh/) instalado no sistema

### Instalação

```bash
# Clonar o repositório
git clone <url-do-repositorio>
cd jogosmatematicos

# Instalar dependências
bun install
```

### Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento com hot reload
bun run dev
```

O site estará disponível em `http://localhost:3000`.

### Build para produção

```bash
# Criar build estática
bun run build
```

Os ficheiros serão gerados na pasta `dist/`.

## 📦 Publicar no GitHub Pages

### Opção 1: Manualmente

1. Executar `bun run build`
2. Copiar o conteúdo da pasta `dist/` para o branch `gh-pages`
3. Ativar GitHub Pages nas definições do repositório (source: `gh-pages`)

### Opção 2: GitHub Actions

Criar o ficheiro `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      
      - run: bun install
      - run: bun run build
      
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## 📜 Regras dos Jogos

As regras completas de cada jogo estão disponíveis no site oficial do CRJM:
- [Regras oficiais do CRJM](https://projetosdre.madeira.gov.pt/crjmram/jogos/)

## 🛠️ Tecnologias

- [React 19](https://react.dev/) - Biblioteca de UI
- [TypeScript](https://www.typescriptlang.org/) - Tipagem estática
- [Tailwind CSS 4](https://tailwindcss.com/) - Estilos
- [Bun](https://bun.sh/) - Runtime, bundler e gestor de pacotes

## 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes de UI reutilizáveis
│   ├── GameCard.tsx
│   ├── GameLayout.tsx
│   ├── Header.tsx
│   ├── PlayerInfo.tsx
│   ├── RulesPanel.tsx
│   └── WinnerAnnouncement.tsx
├── games/
│   ├── gatos-caes/     # Jogo Gatos & Cães
│   │   ├── types.ts
│   │   ├── logic.ts
│   │   └── GatosCaesGame.tsx
│   ├── dominorio/      # Jogo Dominório
│   │   ├── types.ts
│   │   ├── logic.ts
│   │   └── DominorioGame.tsx
│   └── quelhas/        # Jogo Quelhas
│       ├── types.ts
│       ├── logic.ts
│       └── QuelhasGame.tsx
├── types/              # Tipos TypeScript comuns
├── App.tsx             # Componente principal
├── frontend.tsx        # Entrada React
├── index.html          # HTML base
└── index.css           # Estilos globais
```

## 📝 Licença

Este projeto foi criado para fins educativos.

---

🎓 Bom treino e boa sorte no campeonato!
