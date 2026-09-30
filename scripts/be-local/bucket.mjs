// Tạo bucket MinIO private cho ảnh ngựa, dùng AWS SDK có sẵn trong node_modules của BE.
import { createRequire } from 'node:module';
// Dùng AWS SDK trong node_modules của repo backend nằm cạnh repo này.
const require = createRequire(new URL('../../../horse-racing-ne/package.json', import.meta.url));
const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({ endpoint: 'http://localhost:9000', region: 'us-east-1', forcePathStyle: true,
  credentials: { accessKeyId: 'RacehorseMinioAdmin', secretAccessKey: 'Minio@#_Racehorse_WDP301_FPT_FA26' } });
try { await s3.send(new HeadBucketCommand({ Bucket: 'racehorse-media' })); console.log('bucket có sẵn'); }
catch { await s3.send(new CreateBucketCommand({ Bucket: 'racehorse-media' })); console.log('đã tạo bucket racehorse-media'); }
