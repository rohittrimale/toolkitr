# Toolkitr - AI-Powered Mainframe Development Platform

<div align="center">

![Toolkitr](/docs/toolkitr-logo.svg)

**Modern AI-powered platform for mainframe COBOL development, testing, and deployment**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL 14+](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## 🚀 Features

### **AI-Powered Development**
- 🤖 **GitHub Copilot Integration** - Real-time intelligent suggestions for COBOL code
- 🧠 **Agentic Loop Engine** - Autonomous task execution for mainframe operations
- 💬 **Interactive Copilot Chat** - Natural language interface for complex workflows

### **Integrated Development Environment**
- 🖥️ **Browser-Based TN3270 Terminal** - Full 3270 emulation without plugins
- 📝 **Code Editor** - Syntax-highlighted COBOL, JCL, and copybook editing
- 🔍 **Dataset Browser** - Navigate and manage mainframe datasets
- ⚡ **Real-time Compilation** - Instant COBOL compilation feedback

### **Enterprise-Ready**
- 🔐 **GitHub OAuth Authentication** - Secure, enterprise-friendly authentication
- 💾 **PostgreSQL Integration** - Full conversation and code history
- 📊 **Audit Logging** - Complete activity tracking for compliance
- 🌐 **WebSocket Proxy** - Secure connection tunneling for mainframe access

---

## 🎯 Quick Start

### Prerequisites
- **Node.js** 18+ ([download](https://nodejs.org/))
- **PostgreSQL** 14+ ([download](https://www.postgresql.org/))
- **Git** ([download](https://git-scm.com/))
- **GitHub OAuth App** (free - [create one](https://github.com/settings/developers))

### 1️⃣ Clone & Install

```bash
git clone https://github.com/yourusername/toolkitr.git
cd toolkitr

# Install dependencies
npm install
cd backend && npm install && cd ..
```

### 2️⃣ Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit with your configuration
nano .env.local
```

**Required variables:**
```env
# GitHub OAuth (get from https://github.com/settings/developers)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Session encryption (run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
AUTH_SECRET=your_32_char_hex_string

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/toolkitr

# Mainframe (optional - if using SSH scripts)
MAINFRAME_HOST=your.mainframe.host
MAINFRAME_USER=your_username
MAINFRAME_PASSWORD=your_password
```

### 3️⃣ Set Up Database

```bash
# Run migrations
npx prisma migrate dev --name init

# Open Prisma Studio (optional - visual database browser)
npx prisma studio
```

### 4️⃣ Start Development

**Terminal 1 - Frontend (Next.js)**
```bash
npm run dev
# Opens http://localhost:3000
```

**Terminal 2 - Backend (WebSocket Proxy)**
```bash
cd backend
npm run dev
# WebSocket server on ws://localhost:8080
```

### 5️⃣ Access the App

1. Open http://localhost:3000 in your browser
2. Click "Sign in with GitHub"
3. Authorize the OAuth app
4. Start exploring!

---

## 📁 Project Structure

```
toolkitr/
├── src/                          # Frontend (Next.js + React)
│   ├── app/                      # Pages, layouts, routes
│   │   ├── page.tsx             # Main UI layout
│   │   ├── layout.tsx           # Root layout with metadata
│   │   └── api/                 # API routes (auth, chat, files, etc.)
│   │
│   ├── components/               # React components
│   │   ├── assistant/           # AI Copilot components
│   │   ├── sidebar/             # Left sidebar (files, settings)
│   │   ├── terminal/            # TN3270 terminal emulator
│   │   ├── FileViewer.tsx       # File content viewer
│   │   └── BottomPanel.tsx      # Terminal output panel
│   │
│   ├── lib/                      # Business logic & utilities
│   │   ├── ai/                  # AI/prompt engineering
│   │   │   ├── agentic-loop.ts # Core agent orchestration
│   │   │   └── mainframe-prompt.ts # Prompt templates
│   │   ├── auth/                # Authentication
│   │   ├── terminal/            # TN3270 client implementation
│   │   ├── cobol/               # COBOL parsing & analysis
│   │   ├── tools/               # Tool definitions (agent tools)
│   │   └── zos/                 # z/OS system interactions
│   │
│   └── store/                    # Zustand state management
│       └── index.ts             # Global app state
│
├── backend/                      # WebSocket proxy
│   ├── src/
│   │   └── index.ts            # Main proxy server
│   ├── package.json
│   └── tsconfig.json
│
├── prisma/                       # Database
│   ├── schema.prisma           # Data models
│   └── migrations/             # Database migrations
│
├── data/                         # Sample COBOL data
│   └── cobol/
│       ├── programs.txt        # Program listings
│       ├── datasets.txt        # Dataset definitions
│       └── copybooks.txt       # COBOL copybooks
│
├── scripts/                      # Utility scripts
│   ├── create-pds-*.sh
│   ├── create-pds-*.ps1
│   └── CREATE_PDS.jcl
│
├── docs/                         # Documentation
│   ├── README_MODERN.md        # UI/UX documentation
│   ├── CODEBASE_SUMMARY.md     # Architecture overview
│   └── DEV_SETUP.md            # Development guide
│
└── tests/                        # Test files
```

---

## 🔌 Core Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | Next.js 14, React 18, TypeScript | Web UI & state management |
| **Backend Proxy** | Node.js, WebSocket | TN3270 connection tunneling |
| **Database** | PostgreSQL + Prisma | Data persistence |
| **AI** | GitHub Copilot API | Code intelligence |
| **Terminal** | 3270 Protocol | Mainframe emulation |
| **Styling** | Tailwind CSS + Radix UI | Modern responsive UI |

---

## 🛠️ Development

### Available Commands

```bash
# Frontend
npm run dev          # Start dev server
npm run build        # Production build
npm start            # Run production build
npm run lint         # Run linter
npm run type-check   # TypeScript checking

# Backend
cd backend
npm run dev          # Start proxy with auto-reload
npm start            # Run proxy

# Database
npx prisma migrate dev        # Create migration
npx prisma studio            # Open database UI
npx prisma db seed           # Seed test data
npx prisma migrate reset      # Reset database
```

### Testing

```bash
# Run test suite
npm run test

# Run specific test
npm run test -- tests/test-agent-mode.js

# Run with environment variables
SSH_HOST=your.host npm run test
```

### Debugging

```bash
# Enable verbose logging
DEBUG=* npm run dev

# VS Code debugger
# Configure: .vscode/launch.json
```

---

## 📚 Documentation

- **[Setup Guide →](GITHUB_SETUP.md)** - Detailed setup instructions for GitHub
- **[Architecture →](docs/CODEBASE_SUMMARY.md)** - System architecture & data flow
- **[Developer Setup →](docs/DEV_SETUP.md)** - Development environment guide
- **[UI/UX →](docs/README_MODERN.md)** - Interface features & design

---

## 🔐 Security

### Important Notes

⚠️ **Never commit these files:**
- `.env` / `.env.local` - Environment variables
- `.env.*.secret` - Encrypted secrets
- Database backups with real data

✅ **Best Practices:**
- Use strong, unique `AUTH_SECRET` value
- Rotate GitHub OAuth credentials if exposed
- Use environment variables for all secrets
- Enable PostgreSQL SSL in production
- Review audit logs regularly

---

## 🚀 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `AUTH_SECRET`
- [ ] Configure production `DATABASE_URL` (with SSL)
- [ ] Set correct GitHub OAuth redirect URLs
- [ ] Update `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Enable CORS for production domain
- [ ] Set up SSL/TLS certificates
- [ ] Configure mainframe connection details

### Deployment Platforms

**Vercel** (Recommended for Next.js)
```bash
npm install -g vercel
vercel env add GITHUB_CLIENT_ID
vercel env add GITHUB_CLIENT_SECRET
# ... add other env vars
vercel
```

**Docker**
```bash
docker build -t toolkitr .
docker run -e DATABASE_URL=... -p 3000:3000 toolkitr
```

**Self-Hosted**
```bash
npm run build
npm start
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Make** your changes
4. **Test** thoroughly
5. **Commit** with clear messages: `git commit -m "Add feature X"`
6. **Push** to your fork: `git push origin feature/your-feature`
7. **Open** a Pull Request

### Code Style
- Use TypeScript (no `any` types)
- Follow existing naming conventions
- Add comments for complex logic
- Write tests for new features
- Update documentation

---

## ❓ FAQ

**Q: Do I need a real mainframe to use this?**  
A: Yes, you need SSH access to a mainframe running z/OS. For testing the UI, you can use the mock terminal.

**Q: Can I use this on Windows/Mac?**  
A: Yes! The frontend and backend run on any OS. See [Setup Guide](GITHUB_SETUP.md) for platform-specific instructions.

**Q: How do I get GitHub Copilot integration?**  
A: You need a GitHub account with Copilot access. See [Auth Setup](GITHUB_SETUP.md#authentication).

**Q: Is this production-ready?**  
A: Yes, though you should review security before deploying to production.

**Q: How do I report bugs?**  
A: Open a [GitHub Issue](https://github.com/yourusername/toolkitr/issues) with reproduction steps.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- **GitHub Copilot** - AI-powered code suggestions
- **Next.js** - React framework
- **Prisma** - ORM & database toolkit
- **Radix UI** - Accessible component library
- **TN3270** - Mainframe terminal protocol

---

## 📞 Support & Community

- 📖 **Documentation:** See [docs/](docs/) directory
- 💬 **Discussions:** [GitHub Discussions](https://github.com/yourusername/toolkitr/discussions)
- 🐛 **Report Issues:** [GitHub Issues](https://github.com/yourusername/toolkitr/issues)
- 📧 **Email:** support@example.com

---

**Built with ❤️ for mainframe developers**

*Last updated: April 2026*
