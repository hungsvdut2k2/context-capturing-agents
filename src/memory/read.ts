import fs from "fs-extra";
import path from "path";
import { glob } from "glob";
import { getMemoryBasePath } from "./index.js";

export interface ContextFile {
  domain: string;
  topic: string;
  content: string;
  path: string;
}

export interface ProjectStructure {
  project: string;
  domains: {
    name: string;
    topics: string[];
  }[];
}

export async function readContext(
  project: string,
  domain: string,
  topic: string
): Promise<string | null> {
  const filePath = path.join(
    getMemoryBasePath(),
    project,
    domain,
    `${topic}.md`
  );

  if (await fs.pathExists(filePath)) {
    return fs.readFile(filePath, "utf-8");
  }
  return null;
}

export async function readDomain(
  project: string,
  domain: string
): Promise<ContextFile[]> {
  const domainPath = path.join(getMemoryBasePath(), project, domain);
  const files: ContextFile[] = [];

  if (!(await fs.pathExists(domainPath))) {
    return files;
  }

  const mdFiles = await glob("*.md", { cwd: domainPath });

  for (const file of mdFiles) {
    const filePath = path.join(domainPath, file);
    const content = await fs.readFile(filePath, "utf-8");
    files.push({
      domain,
      topic: path.basename(file, ".md"),
      content,
      path: filePath,
    });
  }

  return files;
}

export async function listProjectStructure(
  project: string
): Promise<ProjectStructure | null> {
  const projectPath = path.join(getMemoryBasePath(), project);

  if (!(await fs.pathExists(projectPath))) {
    return null;
  }

  const entries = await fs.readdir(projectPath, { withFileTypes: true });
  const domains: ProjectStructure["domains"] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const domainPath = path.join(projectPath, entry.name);
      const mdFiles = await glob("*.md", { cwd: domainPath });
      domains.push({
        name: entry.name,
        topics: mdFiles.map((f) => path.basename(f, ".md")),
      });
    }
  }

  return { project, domains };
}

export async function listProjects(): Promise<string[]> {
  const basePath = getMemoryBasePath();

  if (!(await fs.pathExists(basePath))) {
    return [];
  }

  const entries = await fs.readdir(basePath, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}
