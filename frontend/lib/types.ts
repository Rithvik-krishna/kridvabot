export interface UploadedImage {
  id: number;
  filename: string;
  thumb_url: string;
}

export interface PhotoGroup {
  id: string;
  image_ids: number[];
}

export interface UploadAndGroupResponse {
  job_id: string;
  images: UploadedImage[];
  groups: PhotoGroup[];
}

export type JobState = "grouped" | "processing" | "done" | "error";

export interface JobStatusResponse {
  status: JobState;
  completed: number;
  total: number;
  message: string;
  error: string | null;
  download_url: string | null;
}

export type WizardStep = 1 | 2 | 3;
