# Agent Skills Framework

Welcome to the Toolkitr Agent Skills documentation. This directory contains comprehensive guides for everything the agent can help you with.

## What is a Skill?

A **skill** is a specialized capability that documents:
- What the agent can do in that domain
- How to ask for help
- Detailed examples and patterns
- Common problems and solutions
- Best practices and recommendations
- Related tools and concepts

Skills are organized by domain (mainframe, COBOL, jobs, etc.) and provide both beginners and experts with:
- **For beginners:** Step-by-step guidance, common patterns, recommended approaches
- **For experts:** Advanced techniques, optimization strategies, edge cases
- **For all:** Reference material, tool documentation, troubleshooting

## Available Skills

### 🏢 [Mainframe Automation](./mainframe-automation.md)

Master IBM z/OS operations through the live Toolkitr terminal.

**You can:**
- Navigate ISPF and execute commands
- Read and write COBOL source members
- Compile and link programs
- Submit and monitor JCL jobs
- Manage datasets and members

**Perfect for:**
- Beginners learning z/OS basics
- Developers managing source code
- Operators submitting batch jobs

**Key tools:** `zvm_read_member`, `zvm_write_dataset`, `zvm_compile`, `zvm_submit_job`

---

### 💼 [COBOL Development](./cobol-development.md)

Advanced COBOL programming assistance and code analysis.

**You can:**
- Review COBOL structure and divisions
- Recognize and apply common patterns
- Debug compilation and runtime errors
- Optimize for performance
- Modernize legacy code

**Perfect for:**
- COBOL developers
- Code maintenance and refactoring
- Performance optimization
- Training and education

**Key tools:** `zvm_read_member`, `zvm_compile`, `search_files`

---

### 📋 [Job Management](./job-management.md)

JCL development, job submission, and monitoring.

**You can:**
- Write and validate JCL syntax
- Submit jobs and monitor execution
- Understand return codes and conditions
- Debug job failures
- Optimize batch performance

**Perfect for:**
- JCL developers
- Batch operations and scheduling
- Job automation
- Performance tuning

**Key tools:** `zvm_submit_job`, `run_command`, `read_file`

---

## How to Use Skills

### 1. Ask the Agent to Help You

**Example:** "I need to compile my COBOL program"

The agent will:
1. Understand this relates to the **COBOL Development** and **Mainframe Automation** skills
2. Use the detailed guidance in those skill files
3. Execute the necessary steps (read source, compile, report results)
4. Provide suggestions based on patterns in the skills

### 2. Reference a Specific Skill

**Example:** "According to the Job Management skill, how do I set up conditional steps in JCL?"

The agent will:
1. Search the `job-management.md` skill file
2. Extract the relevant section with examples
3. Explain the concept
4. Help you apply it to your specific job

### 3. Learn Best Practices

Each skill includes:
- **Common patterns** - Recommended approaches
- **Anti-patterns** - Things to avoid
- **Best practices checklist** - Quality assurance
- **Examples** - Real-world code samples

### 4. Get Help with Errors

**Example:** "I'm getting a compilation error: Undefined variable SALES-AMT"

The agent will:
1. Recognize this relates to **COBOL Development** skill errors section
2. Explain what causes this error
3. Show how to fix it
4. Suggest defensive programming techniques

## Agent Mode Limitations & Capabilities

### What the Agent CAN do

✅ Read and understand existing source code  
✅ Navigate ISPF screens  
✅ Compile COBOL programs  
✅ Submit JCL jobs  
✅ Identify errors and suggest fixes  
✅ Apply common patterns  
✅ Chain multi-step workflows  
✅ Monitor job completion  

### What the Agent CANNOT do

❌ Modify code without your permission  
❌ Delete datasets (too risky)  
❌ Execute non-mainframe commands  
❌ Access systems outside z/OS  
❌ Override security controls  
❌ Change job priorities (if restricted)  

### Agent Iteration Limits

The agent operates in **maximum 10 iterations per request**:
- Each iteration = 1 action (keystroke or tool execution)
- Complex tasks may hit this limit
- **Solution:** Break into multiple requests or use patterns from skills

### Timeouts

- Dataset operations: **30 seconds**
- Compilation: **2 minutes**
- Job submission: **Immediate queue**
- Job status checks: **10 seconds per poll**

## Skill Structure

Each skill file follows this format:

```markdown
---
name: Skill Name
description: What this skill covers
tools: [list of tools used]
keywords: [search keywords]
version: 1.0.0
---

# Skill Title

## Overview
What you can do with this skill

## Key Capabilities
Main things the agent helps with

## Detailed Sections
In-depth guidance, examples, patterns

## Best Practices
Recommended approaches and checklists

## Troubleshooting
Common issues and solutions

## Further Learning
Links to related skills
```

## Combined Skills

Some tasks use **multiple skills together**:

### Scenario: "Compile and run test suite"

This combines:
1. **COBOL Development** - Understanding the source
2. **Mainframe Automation** - Navigating and executing
3. **Job Management** - Submitting test runner job
4. **Mainframe Automation (again)** - Checking results

The agent automatically knows which skills apply and uses them in sequence.

## Extending Skills

### Adding a New Skill

To document a new capability:

1. Create `new-skill.md` in this directory
2. Include YAML frontmatter with metadata
3. Follow the skill template structure
4. Include examples and best practices
5. Link from this README in the skill list

### Creating a Custom Skill (Extensions)

For vendor or custom extensions:

```markdown
---
name: Custom Skill
description: What your extension does
tools: [custom tools]
source: Extension
version: 1.0.0
---
```

## Quick Reference Cards

### Mainframe Commands

```
BROWSE   - Read-only view of dataset
EDIT     - Text editor for member
SUBMIT   - Submit JCL job
DISPLAY  - Show variable or status
```

### COBOL Variable Types

```
PIC 9(5)      - 5-digit number
PIC X(20)     - 20-char text
PIC 9V99      - Number with 2 decimals
PIC S9(5)     - Signed number
PIC S9(5)C    - Number with sign on right
```

### Common JCL Classes

```
A - High priority interactive
B - Medium priority interactive
C - Low priority interactive (default)
D - Background/batch processing
```

## Tips for Success

1. **Start small:** Ask the agent to read simple source first
2. **Build up:** Graduate to compilation and job submission
3. **Use patterns:** Refer to skill examples as templates
4. **Check output:** Always review agent actions and results
5. **Learn iteratively:** Ask follow-up questions for deeper understanding
6. **Automate wisely:** Use skills for repetitive, well-defined tasks

## Support & Questions

If you have questions about:
- **How to use a skill:** Reference that skill's detailed sections
- **What the agent can do:** Check "Capabilities" in each skill
- **Error messages:** Look in skill "Troubleshooting" sections
- **Best practices:** Check skill "Best Practices" checklists

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Mar 18, 2026 | Initial framework with 3 core skills |
| 1.1.0 | *Planned* | Code Navigation skill |
| 1.2.0 | *Planned* | Database/SQL skill |
| 1.3.0 | *Planned* | Performance Tuning skill |

---

**Happy learning! Start with any skill that interests you.**

Need help? Ask the agent: *"Show me the [Skill Name] skill"*
