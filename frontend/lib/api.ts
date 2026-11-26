import {
  JobStatusResponse,
  PhotoGroup,
  UploadAndGroupResponse,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

export function resolveBackendUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.message === "string") return data.message;
  } catch {
    // ignore JSON parse failure
  }
  return `Request failed with status ${res.status}`;
}

export async function fetchDefaultPrompt(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/default-prompt`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  const data = (await res.json()) as { prompt: string };
  return data.prompt;
}

export async function uploadAndGroupPhotos(
  files: File[]
): Promise<UploadAndGroupResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const res = await fetch(`${API_BASE_URL}/api/upload-and-group`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  return (await res.json()) as UploadAndGroupResponse;
}

export async function startCatalogGeneration(
  jobId: string,
  groups: PhotoGroup[],
  prompt: string,
  existingNames: string[]
): Promise<{ status: string; job_id: string }> {
  const res = await fetch(`${API_BASE_URL}/api/generate/${jobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      groups,
      prompt,
      existing_names: existingNames,
    }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  return (await res.json()) as { status: string; job_id: string };
}

export async function fetchJobStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/status/${jobId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  return (await res.json()) as JobStatusResponse;
}
