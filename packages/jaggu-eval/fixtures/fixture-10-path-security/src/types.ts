export interface ServeOptions {
  rootDir: string;
  defaultFile?: string;
  maxAge?: number;
}

export interface FileResponse {
  statusCode: number;
  contentType?: string;
  content?: string;
  error?: string;
}
