# Contributing to Toolkitr

We welcome contributions from the community! This guide will help you get started.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Git
- PostgreSQL 14+ (for development)
- SSH access to a z/OS mainframe (recommended for testing)

### Local Development Setup

1. **Fork & clone**
```bash
git clone https://github.com/your-username/toolkitr.git
cd toolkitr
```

2. **Install dependencies**
```bash
npm install
```

3. **Create `.env.local`**
```bash
cp .env.example .env.local
# Edit with your local configuration
```

4. **Initialize database**
```bash
npx prisma migrate dev
```

5. **Start dev server**
```bash
npm run dev
```

## 🎯 Types of Contributions

### Bug Reports
- Use GitHub Issues
- Include: reproduction steps, expected vs actual behavior, screenshots
- Add labels: `bug`, `priority-level`

### Feature Requests
- Use GitHub Discussions first to gauge interest
- Include: use case, benefits, examples
- Add label: `enhancement`

### Code Contributions
- Follow our code style (see below)
- Add tests for new functionality
- Update documentation
- Submit PR with clear description

### Documentation
- Improve README, API docs, guides
- Add examples and tutorials
- Fix typos and clarify explanations

## 📝 Code Style

### TypeScript/JavaScript
```typescript
// Use strict types
interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Use async/await, not .then()
const data = await fetchData();

// Meaningful variable names
const userConversations = conversations.filter(c => c.userId === currentUser.id);

// JSDoc comments for public functions
/**
 * Downloads a COBOL program with all its dependencies.
 * @param programName - Name of the COBOL program
 * @param maxDepth - Maximum recursion depth (default: 3)
 * @returns Files with their content
 */
export async function downloadCobolWithDependencies(
  programName: string,
  maxDepth: number = 3
): Promise<DownloadResult>
```

### File Organization
```
- One component per file (or related components in index.ts)
- Keep files under 500 lines
- Group related utilities in folders
- Use index.ts for clean exports
```

### Naming Conventions
- **Components**: PascalCase (`FileTree.tsx`, `AICopilot.tsx`)
- **Functions/variables**: camelCase (`downloadFile()`, `userEmail`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_PORT`)
- **Types/Interfaces**: PascalCase (`ScreenContext`, `ApiResponse`)

## 🔄 Development Workflow

1. **Create feature branch**
```bash
git checkout -b feature/amazing-feature
```

2. **Make changes & commit**
```bash
git add .
git commit -m "feat: add amazing feature description"
```

Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style (no logic change)
- `refactor:` - Code refactor
- `test:` - Add tests
- `chore:` - Maintenance

3. **Keep updated with main**
```bash
git fetch origin
git rebase origin/main
```

4. **Push & create PR**
```bash
git push origin feature/amazing-feature
```

## ✅ PR Requirements

Before submitting a PR:

- [ ] Code follows style guide
- [ ] Tests pass (`npm test`)
- [ ] TypeScript compiles (`npm run tsc`)
- [ ] No console errors/warnings
- [ ] Updated relevant documentation
- [ ] Commit messages are clear
- [ ] No breaking changes (or documented)

## 🧪 Testing

```bash
# Type checking
npm run tsc

# Run tests (if configured)
npm test

# Build check
npm run build
```

## 📦 Projects Structure Changes

If modifying file structure:
- Update imports across the codebase
- Update documentation
- Ensure backward compatibility when possible

## 🚀 Deployment

Maintainers use this process:
1. Review & merge PR to `main`
2. Create release tag: `git tag v1.2.3`
3. GitHub Actions auto-deploy
4. Update CHANGELOG

## 🤔 Questions?

- **GitHub Discussions** - General questions & ideas
- **GitHub Issues** - Bug reports & feature tracking
- **Email** - support@toolkitr.com

## 📜 License

By contributing, you agree your code will be licensed under MIT License.

## 🙏 Thank You

Thank you for helping make Toolkitr better for everyone!
