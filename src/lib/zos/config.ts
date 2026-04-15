export const zosConfig = {
  ssh: {
    host: process.env.ZOS_SSH_HOST || '',
    port: parseInt(process.env.ZOS_SSH_PORT || '22'),
    username: process.env.ZOS_SSH_USER || '',
    password: process.env.ZOS_SSH_PASSWORD || '',
    timeout: parseInt(process.env.ZOS_SSH_TIMEOUT || '30000'),
    poolSize: parseInt(process.env.ZOS_SSH_POOL_SIZE || '10'),
  },
  cache: {
    ttlDatasetList: parseInt(process.env.ZOS_CACHE_DATASET_TTL || '300'),
    ttlContent: parseInt(process.env.ZOS_CACHE_CONTENT_TTL || '60'),
    ttlJobs: parseInt(process.env.ZOS_CACHE_JOBS_TTL || '30'),
  },
  defaults: {
    hlq: process.env.ZOS_DEFAULT_HLQ || '',
    volser: process.env.ZOS_DEFAULT_VOLSER || '',
  },
  api: {
    port: parseInt(process.env.ZOS_API_PORT || '3001'),
    host: process.env.ZOS_API_HOST || 'localhost',
  }
};

export default zosConfig;
