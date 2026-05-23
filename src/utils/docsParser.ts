export interface ASTNode {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'formula' | 'alert' | 'code';
  level?: number;
  content: string;
  items?: { text: string; checked?: boolean }[];
  headers?: string[];
  rows?: string[][];
  codeLang?: string;
  alertType?: 'note' | 'tip' | 'important' | 'warning' | 'caution' | 'incident' | 'cause' | 'resolution' | 'info';
}

export interface DocSection {
  id: string;
  title: string;
  level: number;
  nodes: ASTNode[];
  subsections: DocSection[];
}

export function parseMarkdownToAST(markdown: string): DocSection[] {
  const lines = markdown.split(/\r?\n/);
  const rootSections: DocSection[] = [];
  let currentSection: DocSection | null = null;
  let activeNodes: ASTNode[] = [];

  let inCodeBlock = false;
  let codeContent: string[] = [];
  let codeLang = '';

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  let inList = false;
  let listItems: { text: string; checked?: boolean }[] = [];

  let inAlert = false;
  let alertType: ASTNode['alertType'] = 'note';
  let alertLines: string[] = [];

  const flushActiveElements = () => {
    if (inCodeBlock) {
      activeNodes.push({
        type: 'code',
        codeLang,
        content: codeContent.join('\n')
      });
      inCodeBlock = false;
      codeContent = [];
      codeLang = '';
    }
    if (inTable) {
      if (tableHeaders.length > 0 || tableRows.length > 0) {
        activeNodes.push({
          type: 'table',
          content: '',
          headers: tableHeaders,
          rows: tableRows
        });
      }
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
    if (inList) {
      if (listItems.length > 0) {
        activeNodes.push({
          type: 'list',
          content: '',
          items: listItems
        });
      }
      inList = false;
      listItems = [];
    }
    if (inAlert) {
      activeNodes.push({
        type: 'alert',
        alertType,
        content: alertLines.join('\n')
      });
      inAlert = false;
      alertLines = [];
      alertType = 'note';
    }
  };

  const generateId = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();

    // 1. Code Block boundary
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushActiveElements();
      } else {
        flushActiveElements();
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // 2. Alert blocks
    if (trimmed.startsWith('>')) {
      if (!inAlert) {
        flushActiveElements();
        inAlert = true;
        alertLines = [];
        
        // Parse alert type
        const alertHeader = trimmed.slice(1).trim();
        if (alertHeader.includes('[!NOTE]')) alertType = 'note';
        else if (alertHeader.includes('[!TIP]')) alertType = 'tip';
        else if (alertHeader.includes('[!IMPORTANT]')) alertType = 'important';
        else if (alertHeader.includes('[!WARNING]')) alertType = 'warning';
        else if (alertHeader.includes('[!CAUTION]')) alertType = 'caution';
        else if (alertHeader.toLowerCase().includes('incident sign')) alertType = 'incident';
        else if (alertHeader.toLowerCase().includes('root cause')) alertType = 'cause';
        else if (alertHeader.toLowerCase().includes('resolution steps')) alertType = 'resolution';
        else {
          alertType = 'info';
          alertLines.push(alertHeader);
        }
      } else {
        const text = trimmed.slice(1).trim();
        if (text.includes('[!')) {
          // nested alert headers inside
        } else {
          alertLines.push(text);
        }
      }
      continue;
    } else if (inAlert && !trimmed.startsWith('>')) {
      flushActiveElements();
    }

    // 3. Mathematical Formula blocks
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      flushActiveElements();
      activeNodes.push({
        type: 'formula',
        content: trimmed.slice(2, -2).trim()
      });
      continue;
    }
    if (trimmed.startsWith('$$')) {
      flushActiveElements();
      const formulaLines: string[] = [];
      i++;
      while (i < lines.length) {
        const fLine = lines[i];
        if (fLine === undefined) break;
        if (fLine.trim().startsWith('$$')) break;
        formulaLines.push(fLine);
        i++;
      }
      activeNodes.push({
        type: 'formula',
        content: formulaLines.join('\n').trim()
      });
      continue;
    }

    // 4. Headings
    if (trimmed.startsWith('#')) {
      flushActiveElements();
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const title = trimmed.replace(/^#+\s*/, '');
      const newSection: DocSection = {
        id: generateId(title),
        title,
        level,
        nodes: [],
        subsections: []
      };

      if (level === 1) {
        rootSections.push(newSection);
        currentSection = newSection;
      } else if (level === 2) {
        const parent = rootSections[rootSections.length - 1];
        if (parent) {
          parent.subsections.push(newSection);
          currentSection = newSection;
        } else {
          rootSections.push(newSection);
          currentSection = newSection;
        }
      } else if (level === 3) {
        const parent = rootSections[rootSections.length - 1];
        if (parent && parent.subsections.length > 0) {
          const subParent = parent.subsections[parent.subsections.length - 1];
          if (subParent) {
            subParent.subsections.push(newSection);
            currentSection = newSection;
          }
        } else if (parent) {
          parent.subsections.push(newSection);
          currentSection = newSection;
        } else {
          rootSections.push(newSection);
          currentSection = newSection;
        }
      } else {
        // Standardize lower headings as AST heading nodes within current active section
        activeNodes.push({
          type: 'heading',
          level,
          content: title
        });
      }
      continue;
    }

    // 5. Table parsing
    if (trimmed.startsWith('|')) {
      if (!inTable) {
        flushActiveElements();
        inTable = true;
        
        // Header row
        const cols = trimmed.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        tableHeaders = cols;
      } else {
        // Divider row or content row
        if (trimmed.includes('---') || trimmed.includes(':---')) {
          // Divider row, skip
          continue;
        }
        const cols = trimmed.split('|').map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        tableRows.push(cols);
      }
      continue;
    } else if (inTable && !trimmed.startsWith('|')) {
      flushActiveElements();
    }

    // 6. List elements
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\.\s/)) {
      if (!inList) {
        flushActiveElements();
        inList = true;
        listItems = [];
      }
      const textOnly = trimmed.replace(/^(-|\*|\d+\.)\s+/, '');
      const checkedMatch = textOnly.match(/^\[([ xX])\]\s+/);
      if (checkedMatch) {
        const checked = checkedMatch[1] !== ' ';
        const text = textOnly.replace(/^\[([ xX])\]\s+/, '');
        listItems.push({ text, checked });
      } else {
        listItems.push({ text: textOnly });
      }
      continue;
    } else if (inList && !(trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\.\s/))) {
      flushActiveElements();
    }

    // 7. Regular paragraphs
    if (trimmed.length > 0) {
      activeNodes.push({
        type: 'paragraph',
        content: trimmed
      });
    }

    // Flush nodes to section if we switch or if it is the end of document
    if (currentSection && activeNodes.length > 0) {
      // Find the active section to attach to
      currentSection.nodes.push(...activeNodes);
      activeNodes = [];
    }
  }

  // End of file flush
  flushActiveElements();
  if (currentSection && activeNodes.length > 0) {
    currentSection.nodes.push(...activeNodes);
  }

  return rootSections;
}
