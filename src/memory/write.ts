import fs from "fs-extra";
import path from "path";
import { getMemoryBasePath } from "./index.js";

export interface WriteOptions {
  project: string;
  domain: string;
  topic: string;
  content: string;
}

export async function writeContext(options: WriteOptions): Promise<string> {
  const { project, domain, topic, content } = options;
  const dirPath = path.join(getMemoryBasePath(), project, domain);
  const filePath = path.join(dirPath, `${topic}.md`);

  await fs.ensureDir(dirPath);
  await fs.writeFile(filePath, content, "utf-8");

  return filePath;
}

export async function createDomain(
  project: string,
  domain: string
): Promise<string> {
  const dirPath = path.join(getMemoryBasePath(), project, domain);
  await fs.ensureDir(dirPath);
  return dirPath;
}

export async function initProject(project: string): Promise<string> {
  const projectPath = path.join(getMemoryBasePath(), project);
  await fs.ensureDir(projectPath);
  return projectPath;
}
