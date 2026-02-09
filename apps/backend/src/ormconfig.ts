import { DataSource, Logger } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import k from './constant';
class TruncatedLogger implements Logger {
  private truncateValue(value: any): any {
    if (Buffer.isBuffer(value)) {
      return `<Buffer[${value.length} bytes] (truncated)>`;
    }
    if (Array.isArray(value)) {
      if (value.length > 10) {
        return `[${value
          .slice(0, 10)
          .map((v) => this.truncateValue(v))
          .join(',')}... (${value.length} items)]`;
      }
      return value.map((v) => this.truncateValue(v));
    }
    if (typeof value === 'string' && value.length > 200) {
      return `${value.substring(0, 200)}... (${value.length} chars)`;
    }
    if (value && typeof value === 'object') {
      if ('file' in value && Buffer.isBuffer(value.file)) {
        return {
          ...value,
          file: `<Buffer[${value.file.length} bytes] (truncated)>`,
        };
      }
    }
    return value;
  }

  logQuery(query: string, parameters?: any[]) {
    const safeParameters = parameters?.map((param) =>
      this.truncateValue(param)
    );
    let safeQuery = query;
    if (query.length > 1000) {
      safeQuery = query.substring(0, 1000) + '... (query truncated)';
    }
    console.log(
      `[QUERY] ${safeQuery}`,
      safeParameters?.length
        ? `[PARAMETERS] ${JSON.stringify(safeParameters)}`
        : ''
    );
  }

  logQueryError(error: string, query: string, parameters?: any[]) {
    const safeParameters = parameters?.map((param) =>
      this.truncateValue(param)
    );
    let safeQuery = query;
    if (query.length > 1000) {
      safeQuery = query.substring(0, 1000) + '... (query truncated)';
    }
    console.error(
      `[QUERY ERROR] ${error}`,
      `[QUERY] ${safeQuery}`,
      safeParameters?.length
        ? `[PARAMETERS] ${JSON.stringify(safeParameters)}`
        : ''
    );
  }

  logQuerySlow(time: number, query: string, parameters?: any[]) {
    const safeParameters = parameters?.map((param) =>
      this.truncateValue(param)
    );
    let safeQuery = query;
    if (query.length > 1000) {
      safeQuery = query.substring(0, 1000) + '... (query truncated)';
    }
    console.warn(
      `[SLOW QUERY] ${time}ms`,
      `[QUERY] ${safeQuery}`,
      safeParameters?.length
        ? `[PARAMETERS] ${JSON.stringify(safeParameters)}`
        : ''
    );
  }

  logSchemaBuild(message: string) {
    console.log(`[SCHEMA] ${message}`);
  }

  logMigration(message: string) {
    console.log(`[MIGRATION] ${message}`);
  }

  log(level: 'log' | 'info' | 'warn', message: any) {
    const safeMessage = this.truncateValue(message);
    if (level === 'log' || level === 'info') {
      console.log(`[TYPEORM]`, safeMessage);
    } else {
      console.warn(`[TYPEORM]`, safeMessage);
    }
  }
}
const isDevelopment =
  process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
const entityPath = isDevelopment
  ? ['src/**/*.entity.ts']
  : ['dist/**/*.entity.{ts,js}'];
const shouldSynchronize = process.env.TYPEORM_SYNCHRONIZE === 'true';
if (shouldSynchronize) {
  console.warn(
    '⚠️  TypeORM synchronize is enabled - this should not be used in production!'
  );
} else {
  console.log(
    'TypeORM synchronize is disabled - using migrations for schema changes'
  );
}
const options: PostgresConnectionOptions = {
  type: 'postgres',
  host: k.POSTGRES_HOST,
  port: k.POSTGRES_PORT,
  username: k.POSTGRES_USER,
  password: k.POSTGRES_PASSWORD,
  database: k.POSTGRES_DB,
  synchronize: shouldSynchronize,
  useUTC: true,
  entities: entityPath,
  migrations: ['dist/migrations/*.{ts,js}'],
  logging: true,
  logger: new TruncatedLogger(),
  extra: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },
  connectTimeoutMS: 10000,
};
const datasource = new DataSource(options);
export { options };
export default datasource;
