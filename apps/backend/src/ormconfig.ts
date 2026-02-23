import { DataSource, Logger } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import k from './constant';
class TruncatedLogger implements Logger {
  private truncateValue(value: unknown): unknown {
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

  logQuery(query: string, parameters?: unknown[]) {
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

  logQueryError(error: string, query: string, parameters?: unknown[]) {
    const safeParameters = parameters?.map((param) =>
      this.truncateValue(param)
    );
    console.error(
      `[QUERY ERROR] ${error}`,
      `[QUERY] ${query}`,
      safeParameters?.length
        ? `[PARAMETERS] ${JSON.stringify(safeParameters)}`
        : ''
    );
  }

  logQuerySlow(time: number, query: string, parameters?: unknown[]) {
    const safeParameters = parameters?.map((param) =>
      this.truncateValue(param)
    );
    console.warn(
      `[SLOW QUERY: ${time}ms] ${query}`,
      safeParameters?.length
        ? `[PARAMETERS] ${JSON.stringify(safeParameters)}`
        : ''
    );
  }

  logSchemaBuild(message: string) {
    console.log(`[SCHEMA BUILD] ${message}`);
  }

  logMigration(message: string) {
    console.log(`[MIGRATION] ${message}`);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown) {
    console[level](`[${level.toUpperCase()}] ${message}`);
  }
}

const dataSourceOptions: PostgresConnectionOptions = {
  type: 'postgres',
  host: k.POSTGRES_HOST, // Updated to use POSTGRES_HOST
  port: k.POSTGRES_PORT, // Updated to use POSTGRES_PORT
  username: k.POSTGRES_USER, // Updated to use POSTGRES_USER
  password: k.POSTGRES_PASSWORD, // Updated to use POSTGRES_PASSWORD
  database: k.POSTGRES_DB, // Updated to use POSTGRES_DB
  synchronize: false,
  logging: true,
  logger: new TruncatedLogger(),
};

export const AppDataSource = new DataSource(dataSourceOptions);
const options = dataSourceOptions;
export { options }; // Exporting options explicitly
