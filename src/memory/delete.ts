import fs from "fs-extra";
import path from "path";
import { getMemoryBasePath } from "./index.js";

export async function deleteContext(
  project: string,
  domain: string,
  topic: string
): Promise<boolean> {
  const filePath = path.join(
    getMemoryBasePath(),
    project,
    domain,
    `${topic}.md`
  );

  if (!(await fs.pathExists(filePath))) {
    return false;
  }

  await fs.remove(filePath);
  return true;
}

export async function deleteDomain(
  project: string,
  domain: string
): Promise<boolean> {
  const domainPath = path.join(getMemoryBasePath(), project, domain);

  if (!(await fs.pathExists(domainPath))) {
    return false;
  }

  await fs.remove(domainPath);
  return true;
}

export async function deleteProject(project: string): Promise<boolean> {
  const projectPath = path.join(getMemoryBasePath(), project);

  if (!(await fs.pathExists(projectPath))) {
    return false;
  }

  await fs.remove(projectPath);
  return true;
}
