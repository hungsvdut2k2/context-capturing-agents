import fs from "fs-extra";
import path from "path";
import { getMemoryBasePath } from "./index.js";

export interface UpdateOptions {
  project: string;
  domain: string;
  topic: string;
  content: string;
}

export async function updateContext(options: UpdateOptions): Promise<boolean> {
  const { project, domain, topic, content } = options;
  const filePath = path.join(
    getMemoryBasePath(),
    project,
    domain,
    `${topic}.md`
  );

  if (!(await fs.pathExists(filePath))) {
    return false;
  }

  await fs.writeFile(filePath, content, "utf-8");
  return true;
}

export async function appendContext(
  project: string,
  domain: string,
  topic: string,
  content: string
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

  const existing = await fs.readFile(filePath, "utf-8");
  await fs.writeFile(filePath, existing + "\n" + content, "utf-8");
  return true;
}

export async function renameTopic(
  project: string,
  domain: string,
  oldTopic: string,
  newTopic: string
): Promise<boolean> {
  const oldPath = path.join(
    getMemoryBasePath(),
    project,
    domain,
    `${oldTopic}.md`
  );
  const newPath = path.join(
    getMemoryBasePath(),
    project,
    domain,
    `${newTopic}.md`
  );

  if (!(await fs.pathExists(oldPath))) {
    return false;
  }

  await fs.rename(oldPath, newPath);
  return true;
}

export async function renameDomain(
  project: string,
  oldDomain: string,
  newDomain: string
): Promise<boolean> {
  const oldPath = path.join(getMemoryBasePath(), project, oldDomain);
  const newPath = path.join(getMemoryBasePath(), project, newDomain);

  if (!(await fs.pathExists(oldPath))) {
    return false;
  }

  await fs.rename(oldPath, newPath);
  return true;
}
