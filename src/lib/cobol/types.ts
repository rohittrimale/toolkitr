export type FileType = 'program' | 'copybook' | 'jcl' | 'proc' | 'control-card' | 'job-doc';

export interface ResolvedDependency {
  name: string;
  type: FileType;
  dataset?: string;
  content?: string;
  length?: number;
}

export interface DependencyError {
  name: string;
  error: string;
}

export interface DependencyResult {
  files: ResolvedDependency[];
  errors: DependencyError[];
  summary?: string;
}

export interface ServiceMatch {
  serviceKey: string;
  programName: string;
  serviceName: string;
  domain?: string;
}

export interface SoapServiceResult {
  matchedServices: ServiceMatch[];
  files: ResolvedDependency[];
  errors: DependencyError[];
  summary?: string;
}

export interface ComponentEntry {
  dept: string;
  type: string;
  name: string;
}

export interface DatasetMapping {
  code: string;
  dataset: string;
  description?: string;
}

export interface ServiceProgramMapping {
  serviceKey: string;
  serviceName: string;
  programName: string;
  domain?: string;
}
