# Getting Started with Toolkitr

Quick start guide to set up and use Toolkitr for mainframe COBOL development.

## 5-Minute Setup

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+
- GitHub account (for OAuth)
- Mainframe SSH access (optional)

### 2. Installation
```bash
git clone https://github.com/rohittrimale/toolkitr.git
cd toolkitr
npm install
```

### 3. Configuration
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Required for database
DATABASE_URL=postgresql://postgres:password@localhost:5432/toolkitr

# Required for GitHub OAuth (get from GitHub App settings)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Optional: Your mainframe details (can be provided in UI)
MAINFRAME_HOST=zos.company.com
MAINFRAME_PORT=22
```

### 4. Database Setup
```bash
npx prisma migrate dev
```

### 5. Start Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## First Steps

### 1. Login
- Click "Login with GitHub"
- Authorize the application
- You're in!

### 2. Chat Mode
- Select **Ask** mode
- Ask questions about COBOL, JCL, mainframe topics
- AI provides explanations and code samples

### 3. Connect to Mainframe (Optional)
- Click "Settings" → "Mainframe Connection"
- Enter: Host, Port, Username, Password
- Click "Connect"
- Terminal will show mainframe screen

### 4. Analyze COBOL Code
- Select **Edit** or **Agent** mode
- Provide COBOL code or program name
- AI analyzes and provides suggestions
- In Agent mode: AI downloads dependencies and executes commands

---

## Common Tasks

### Task 1: Get Explanation of COBOL Program

**Chat Mode**: Ask
```
"Analyze PROG001 and explain what it does"
```

**In Terminal**: 
1. Connect to mainframe
2. Navigate to dataset using ISPF
3. Select program file
4. Ask AI about it

**Result**: AI analyzes code and provides detailed explanation

### Task 2: Fix Compilation Errors

**Chat Mode**: Agent
```
"Compile MYJOB and fix any syntax errors"
```

**What AI does**:
1. Downloads JCL + programs
2. Submits compilation job
3. Retrieves error messages
4. Suggests fixes based on errors
5. You apply fixes manually or AI modifies code

### Task 3: Download Program with Dependencies

**Chat Mode**: Agent
```
"Download MAINPROG with all its dependencies"
```

**Files Retrieved**:
- MAINPROG.cobol
- All COPY'd copybooks
- All CALL'd programs
- All CICS LINK'd transactions

### Task 4: Live Terminal Navigation

1. Connect to mainframe
2. Type commands in terminal (e.g., "ISPF" or "3.4")
3. Press Enter
4. Navigate using keyboard
5. While viewing dataset → Ask AI questions

---

## Understanding Modes

### Ask Mode ✅
- **Use when**: You want questions answered, explanations, learning
- **Tools**: None (AI responds with text only)
- **Examples**:
  - "How do I write a recursive COBOL program?"
  - "What's the difference between VSAM KSDS and ESDS?"
  - "Explain this JCL PROC"

### Edit Mode ✅
- **Use when**: You want AI to help refactor, fix, or generate code
- **Tools**: Codebase search, file read/write, code analysis
- **Examples**:
  - "Refactor this function for better performance"
  - "Generate unit tests for this COBOL module"
  - "Add error handling to this code"

### Agent Mode ⚡
- **Use when**: You want AI to execute multi-step workflows autonomously
- **Tools**: ALL (COBOL, z/OS, files, mainframe operations)
- **Examples**:
  - "Download PROG001 and analyze its dependencies"
  - "Submit MYJOB, check for errors, compile again"
  - "Find all programs using dataset COMMON.COPYBOOK and update them"

---

## Terminal Usage

### Connection
1. Click "Settings" → "SSH Connection"
2. Enter credentials
3. Click "Connect"
4. Status shows: "Connected to host:port"

### Keyboard Shortcuts
- **Enter**: Send input fields to mainframe
- **Tab**: Move to next field
- **Shift+Tab**: Move to previous field
- **Ctrl+Alt+P**: Paste (if supported)
- **Ctrl+C**: Send interrupt
- **F1-F24**: Function keys (ISPF PF keys)

### Navigation Example
```
1. See "ISPF/PDF Primary Option Menu"
2. Type "3" (Edit)
3. Press Enter → "ISPF/PDF Edit Primary Menu"
4. Type "3.4" (View/Edit Datasets)
5. Press Enter → "Dataset Selection Panel"
6. Type dataset name, press Enter
7. Browse and edit files
```

---

## Troubleshooting

### "Cannot connect to mainframe"
- ✅ Verify SSH credentials are correct
- ✅ Check if mainframe host is reachable: `ping your.mainframe.com`
- ✅ Verify port 22 is open (or custom SSH port)
- ✅ Check firewall allows outbound SSH

### "AI model not responding"
- ✅ Check GitHub Copilot token is valid
- ✅ Verify API keys in `.env.local`
- ✅ Check rate limit (default: 60 req/min per user)
- ✅ Try switching to different model

### "Database connection failed"
- ✅ Ensure PostgreSQL is running locally
- ✅ Check `DATABASE_URL` is correct
- ✅ Run: `psql -U postgres -h localhost` to test
- ✅ Run: `npx prisma db push` to sync

### "TypeScript errors after npm install"
```bash
npm run tsc         # Check type errors
npm run clean       # Clean cache
npm install         # Reinstall deps
npm run build       # Try rebuild
```

---

## Keyboard Shortcuts (IDE)

| Shortcut | Action |
|----------|--------|
| `Ctrl+K Ctrl+O` | Open file |
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+/` | Toggle comment |
| `Alt+Up/Down` | Move line up/down |
| `Ctrl+Shift+L` | Select all occurrences |

---

## Environment Variables Reference

```env
# Database (Required)
DATABASE_URL=postgresql://user:pass@localhost:5432/toolkitr

# GitHub OAuth (Required for login)
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# Copilot API (Optional - auto derived from GitHub token)
COPILOT_API_KEY=xxx

# Mainframe SSH (Optional - provided in UI)
MAINFRAME_HOST=zos.example.com
MAINFRAME_PORT=22
MAINFRAME_USER=your_userid

# Advanced
NODE_ENV=development              # or production
LOG_LEVEL=debug                   # debug, info, warn, error
RATE_LIMIT_REQUESTS=60            # per minute
RATE_LIMIT_WINDOW=60000          # milliseconds
```

---

## Next Steps

- Read [API Documentation](API.md)
- Explore [Architecture Guide](ARCHITECTURE.md)
- Check [z/OS Operations](ZOS_OPERATIONS.md)
- Join [GitHub Discussions](https://github.com/rohittrimale/toolkitr/discussions)

---

**Ready to supercharge your mainframe development? 🚀**
