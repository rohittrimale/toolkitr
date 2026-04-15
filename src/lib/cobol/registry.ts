import * as fs from 'fs';
import * as path from 'path';
import { ComponentEntry, DatasetMapping, ServiceProgramMapping } from './types';

let _components: ComponentEntry[] = [];
let _datasets: DatasetMapping[] = [];
let _programs: string[] = [];
let _copybooks: string[] = [];
let _procs: string[] = [];
let _jcl: string[] = [];
let _services: ServiceProgramMapping[] = [];
let _registryLoaded = false;

const DATA_DIR = path.join(process.cwd(), 'data', 'cobol');

export function loadRegistry(): void {
  if (_registryLoaded) return;
  
  try {
    const componentsPath = path.join(DATA_DIR, 'components.txt');
    if (fs.existsSync(componentsPath)) {
      const raw = fs.readFileSync(componentsPath, 'utf8');
      const lines = raw.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split('|');
        if (parts.length >= 3) {
          _components.push({
            dept: parts[0].trim(),
            type: parts[1].trim(),
            name: parts[2].trim()
          });
        }
      }
      console.log(`[COBOL] Registry loaded ${_components.length} components`);
    }
  } catch (err) {
    console.warn('[COBOL] Failed to load components.txt:', err);
  }
  
  try {
    const datasetsPath = path.join(DATA_DIR, 'datasets.txt');
    if (fs.existsSync(datasetsPath)) {
      const raw = fs.readFileSync(datasetsPath, 'utf8');
      const lines = raw.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split('|');
        if (parts.length >= 2) {
          _datasets.push({
            code: parts[0].trim(),
            dataset: parts[1].trim(),
            description: parts[2]?.trim()
          });
        }
      }
    }
  } catch (err) {
    console.warn('[COBOL] Failed to load datasets.txt:', err);
  }
  
  try {
    const programsPath = path.join(DATA_DIR, 'programs.txt');
    if (fs.existsSync(programsPath)) {
      _programs = fs.readFileSync(programsPath, 'utf8')
        .split(/\r?\n/)
        .filter(line => line.trim())
        .map(line => line.trim());
    }
  } catch (err) {
    console.warn('[COBOL] Failed to load programs.txt:', err);
  }
  
  try {
    const copybooksPath = path.join(DATA_DIR, 'copybooks.txt');
    if (fs.existsSync(copybooksPath)) {
      _copybooks = fs.readFileSync(copybooksPath, 'utf8')
        .split(/\r?\n/)
        .filter(line => line.trim())
        .map(line => line.trim());
    }
  } catch (err) {
    console.warn('[COBOL] Failed to load copybooks.txt:', err);
  }
  
  try {
    const procsPath = path.join(DATA_DIR, 'procs.txt');
    if (fs.existsSync(procsPath)) {
      _procs = fs.readFileSync(procsPath, 'utf8')
        .split(/\r?\n/)
        .filter(line => line.trim())
        .map(line => line.trim());
    }
  } catch (err) {
    console.warn('[COBOL] Failed to load procs.txt:', err);
  }
  
  try {
    const jclPath = path.join(DATA_DIR, 'jcl.txt');
    if (fs.existsSync(jclPath)) {
      _jcl = fs.readFileSync(jclPath, 'utf8')
        .split(/\r?\n/)
        .filter(line => line.trim())
        .map(line => line.trim());
    }
  } catch (err) {
    console.warn('[COBOL] Failed to load jcl.txt:', err);
  }
  
  try {
    const servicesPath = path.join(DATA_DIR, 'services-program-map.txt');
    if (fs.existsSync(servicesPath)) {
      const raw = fs.readFileSync(servicesPath, 'utf8');
      const lines = raw.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split('|');
        if (parts.length >= 3) {
          _services.push({
            serviceKey: parts[0].trim(),
            serviceName: parts[1].trim(),
            programName: parts[2].trim(),
            domain: parts[3]?.trim()
          });
        }
      }
    }
  } catch (err) {
    console.warn('[COBOL] Failed to load services-program-map.txt:', err);
  }
  
  _registryLoaded = true;
}

export function getComponents(): ComponentEntry[] {
  if (!_registryLoaded) loadRegistry();
  return _components;
}

export function getDatasets(): DatasetMapping[] {
  if (!_registryLoaded) loadRegistry();
  return _datasets;
}

export function getProgramDatasets(): string[] {
  if (!_registryLoaded) loadRegistry();
  return _programs;
}

export function getCopybookDatasets(): string[] {
  if (!_registryLoaded) loadRegistry();
  return _copybooks;
}

export function getProcDatasets(): string[] {
  if (!_registryLoaded) loadRegistry();
  return _procs;
}

export function getJclDatasets(): string[] {
  if (!_registryLoaded) loadRegistry();
  return _jcl;
}

export function getServiceMappings(): ServiceProgramMapping[] {
  if (!_registryLoaded) loadRegistry();
  return _services;
}

export function findComponentByName(name: string): ComponentEntry | undefined {
  if (!_registryLoaded) loadRegistry();
  const upperName = name.toUpperCase();
  return _components.find(c => c.name.toUpperCase() === upperName);
}

export function findComponentsByType(type: string): ComponentEntry[] {
  if (!_registryLoaded) loadRegistry();
  const upperType = type.toUpperCase();
  return _components.filter(c => c.type.toUpperCase() === upperType);
}

export function findDatasetByCode(code: string): DatasetMapping | undefined {
  if (!_registryLoaded) loadRegistry();
  const upperCode = code.toUpperCase();
  return _datasets.find(d => d.code.toUpperCase() === upperCode);
}

export function findServiceByKey(serviceKey: string): ServiceProgramMapping | undefined {
  if (!_registryLoaded) loadRegistry();
  const upperKey = serviceKey.toUpperCase();
  return _services.find(s => s.serviceKey.toUpperCase() === upperKey);
}

export function findServicesByProgram(programName: string): ServiceProgramMapping[] {
  if (!_registryLoaded) loadRegistry();
  const upperProg = programName.toUpperCase();
  return _services.filter(s => s.programName.toUpperCase() === upperProg);
}

export function searchServices(query: string): ServiceProgramMapping[] {
  if (!_registryLoaded) loadRegistry();
  const upperQuery = query.toUpperCase();
  return _services.filter(s => 
    s.serviceKey.toUpperCase().includes(upperQuery) ||
    s.serviceName.toUpperCase().includes(upperQuery) ||
    s.programName.toUpperCase().includes(upperQuery) ||
    (s.domain && s.domain.toUpperCase().includes(upperQuery))
  );
}

export function getRegistryStats() {
  if (!_registryLoaded) loadRegistry();
  return {
    components: _components.length,
    datasets: _datasets.length,
    programs: _programs.length,
    copybooks: _copybooks.length,
    procs: _procs.length,
    jcl: _jcl.length,
    services: _services.length
  };
}
