'use client';

import { PrismAsyncLight as SyntaxHighlighterPrism } from 'react-syntax-highlighter';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import { coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

// Register languages
SyntaxHighlighterPrism.registerLanguage('js', tsx);
SyntaxHighlighterPrism.registerLanguage('jsx', tsx);
SyntaxHighlighterPrism.registerLanguage('ts', tsx);
SyntaxHighlighterPrism.registerLanguage('tsx', tsx);
SyntaxHighlighterPrism.registerLanguage('python', python);
SyntaxHighlighterPrism.registerLanguage('py', python);
SyntaxHighlighterPrism.registerLanguage('json', json);
SyntaxHighlighterPrism.registerLanguage('sql', sql);
SyntaxHighlighterPrism.registerLanguage('bash', bash);
SyntaxHighlighterPrism.registerLanguage('sh', bash);
SyntaxHighlighterPrism.registerLanguage('shell', bash);
SyntaxHighlighterPrism.registerLanguage('html', markup);
SyntaxHighlighterPrism.registerLanguage('xml', markup);
SyntaxHighlighterPrism.registerLanguage('css', css);
SyntaxHighlighterPrism.registerLanguage('java', java);
SyntaxHighlighterPrism.registerLanguage('yaml', yaml);
SyntaxHighlighterPrism.registerLanguage('yml', yaml);
SyntaxHighlighterPrism.registerLanguage('md', markdown);
SyntaxHighlighterPrism.registerLanguage('cobol', bash); // Use bash as fallback for COBOL
SyntaxHighlighterPrism.registerLanguage('cob', bash);
SyntaxHighlighterPrism.registerLanguage('jcl', bash);
SyntaxHighlighterPrism.registerLanguage('csv', bash); // Use bash as fallback for CSV
SyntaxHighlighterPrism.registerLanguage('txt', bash);

interface SyntaxHighlighterProps {
  language: string;
  children: string;
}

export default function SyntaxHighlighter({ language, children }: SyntaxHighlighterProps) {
  // Normalize language name
  const langMap: Record<string, string> = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    py: 'python', sh: 'bash', shell: 'bash', yml: 'yaml',
    md: 'markdown', cob: 'cobol', cbl: 'cobol', txt: 'plaintext',
    csv: 'csv', jcl: 'jcl', cobol: 'cobol',
  };
  const normalizedLang = langMap[language] || language;

  return (
    <SyntaxHighlighterPrism
      language={normalizedLang}
      style={coldarkDark}
      customStyle={{
        margin: 0,
        width: '100%',
        background: 'transparent',
        padding: '1rem',
        fontSize: '13px',
        lineHeight: '1.5',
      }}
      codeTagProps={{
        style: {
          fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
        }
      }}
    >
      {children}
    </SyntaxHighlighterPrism>
  );
}
