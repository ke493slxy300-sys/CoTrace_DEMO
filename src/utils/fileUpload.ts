import type { CodeFile, CodeLanguage } from '../types';

const ACCEPTED_EXTENSIONS = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.html',
  '.css',
  '.json',
] as const;

export const FILE_ACCEPT = ACCEPTED_EXTENSIONS.join(',');

function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index).toLowerCase() : '';
}

export function detectLanguage(fileName: string): CodeLanguage {
  switch (getExtension(fileName)) {
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.js':
    case '.jsx':
      return 'javascript';
    case '.py':
      return 'python';
    case '.html':
      return 'html';
    case '.css':
      return 'css';
    case '.json':
      return 'json';
    default:
      return 'text';
  }
}

export function isAcceptedCodeFile(file: File): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(getExtension(file.name));
}

export async function readLocalCodeFile(
  file: File,
  taskId: string,
): Promise<CodeFile> {
  if (!isAcceptedCodeFile(file)) {
    throw new Error(
      `不支持的文件类型「${file.name}」。请选择 ${ACCEPTED_EXTENSIONS.join(' / ')} 文件。`,
    );
  }

  let content: string;
  try {
    content = await file.text();
  } catch {
    throw new Error(`读取「${file.name}」失败，请重试。`);
  }

  if (content.length === 0) {
    throw new Error(`「${file.name}」为空文件，请选择有内容的代码文件。`);
  }

  return {
    id: `file-upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    language: detectLanguage(file.name),
    content,
    taskId,
    source: 'upload',
  };
}

export type UploadBatchResult = {
  files: CodeFile[];
  errors: string[];
};

export async function readLocalCodeFiles(
  fileList: FileList | File[],
  taskId: string,
): Promise<UploadBatchResult> {
  const files: CodeFile[] = [];
  const errors: string[] = [];

  for (const file of Array.from(fileList)) {
    try {
      files.push(await readLocalCodeFile(file, taskId));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `读取「${file.name}」失败。`);
    }
  }

  return { files, errors };
}
