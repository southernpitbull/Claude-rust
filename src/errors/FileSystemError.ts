/**
 * File System Error Classes
 *
 * Handles errors related to file system operations
 */

import { BaseError, BaseErrorOptions, ErrorCategory, ErrorSeverity } from './BaseError';

/**
 * File system error codes
 */
export enum FileSystemErrorCode {
  FILE_NOT_FOUND = 'FS_FILE_NOT_FOUND',
  DIRECTORY_NOT_FOUND = 'FS_DIRECTORY_NOT_FOUND',
  FILE_ALREADY_EXISTS = 'FS_FILE_ALREADY_EXISTS',
  DIRECTORY_ALREADY_EXISTS = 'FS_DIRECTORY_ALREADY_EXISTS',
  PERMISSION_DENIED = 'FS_PERMISSION_DENIED',
  READ_FAILED = 'FS_READ_FAILED',
  WRITE_FAILED = 'FS_WRITE_FAILED',
  DELETE_FAILED = 'FS_DELETE_FAILED',
  COPY_FAILED = 'FS_COPY_FAILED',
  MOVE_FAILED = 'FS_MOVE_FAILED',
  INVALID_PATH = 'FS_INVALID_PATH',
  DISK_FULL = 'FS_DISK_FULL',
  NOT_A_FILE = 'FS_NOT_A_FILE',
  NOT_A_DIRECTORY = 'FS_NOT_A_DIRECTORY',
  DIRECTORY_NOT_EMPTY = 'FS_DIRECTORY_NOT_EMPTY',
}

/**
 * Base File System Error
 */
export class FileSystemError extends BaseError {
  public readonly path?: string;
  public readonly operation?: string;

  constructor(
    message: string,
    options: BaseErrorOptions & { path?: string; operation?: string } = {}
  ) {
    super(message, {
      ...options,
      category: ErrorCategory.FILESYSTEM,
      code: options.code ?? FileSystemErrorCode.READ_FAILED,
      context: {
        ...options.context,
        path: options.path,
        operation: options.operation,
      },
    });

    this.path = options.path;
    this.operation = options.operation;
  }

  protected generateUserMessage(): string {
    const pathInfo = this.path ? ` '${this.path}'` : '';
    return `File system error${pathInfo}: ${this.message}`;
  }
}

/**
 * File Not Found Error
 */
export class FileNotFoundError extends FileSystemError {
  constructor(filePath: string, options: BaseErrorOptions = {}) {
    super(`File not found: ${filePath}`, {
      ...options,
      code: FileSystemErrorCode.FILE_NOT_FOUND,
      severity: ErrorSeverity.MEDIUM,
      path: filePath,
      operation: 'read',
    });
  }

  protected generateUserMessage(): string {
    return `File not found: '${this.path}'`;
  }
}

/**
 * Directory Not Found Error
 */
export class DirectoryNotFoundError extends FileSystemError {
  constructor(dirPath: string, options: BaseErrorOptions = {}) {
    super(`Directory not found: ${dirPath}`, {
      ...options,
      code: FileSystemErrorCode.DIRECTORY_NOT_FOUND,
      severity: ErrorSeverity.MEDIUM,
      path: dirPath,
      operation: 'read',
    });
  }

  protected generateUserMessage(): string {
    return `Directory not found: '${this.path}'`;
  }
}

/**
 * File Already Exists Error
 */
export class FileAlreadyExistsError extends FileSystemError {
  constructor(filePath: string, options: BaseErrorOptions = {}) {
    super(`File already exists: ${filePath}`, {
      ...options,
      code: FileSystemErrorCode.FILE_ALREADY_EXISTS,
      severity: ErrorSeverity.LOW,
      path: filePath,
      operation: 'create',
    });
  }

  protected generateUserMessage(): string {
    return `File already exists: '${this.path}'`;
  }
}

/**
 * Directory Already Exists Error
 */
export class DirectoryAlreadyExistsError extends FileSystemError {
  constructor(dirPath: string, options: BaseErrorOptions = {}) {
    super(`Directory already exists: ${dirPath}`, {
      ...options,
      code: FileSystemErrorCode.DIRECTORY_ALREADY_EXISTS,
      severity: ErrorSeverity.LOW,
      path: dirPath,
      operation: 'create',
    });
  }

  protected generateUserMessage(): string {
    return `Directory already exists: '${this.path}'`;
  }
}

/**
 * File Permission Denied Error
 */
export class FilePermissionDeniedError extends FileSystemError {
  constructor(path: string, operation: string, options: BaseErrorOptions = {}) {
    super(`Permission denied: ${operation} '${path}'`, {
      ...options,
      code: FileSystemErrorCode.PERMISSION_DENIED,
      severity: ErrorSeverity.HIGH,
      path,
      operation,
    });
  }

  protected generateUserMessage(): string {
    return `Permission denied: Cannot ${this.operation} '${this.path}'`;
  }
}

/**
 * File Read Failed Error
 */
export class FileReadError extends FileSystemError {
  constructor(filePath: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Failed to read file '${filePath}': ${reason}`, {
      ...options,
      code: FileSystemErrorCode.READ_FAILED,
      severity: ErrorSeverity.HIGH,
      path: filePath,
      operation: 'read',
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to read file '${this.path}': ${this.context.reason}`;
  }
}

/**
 * File Write Failed Error
 */
export class FileWriteError extends FileSystemError {
  constructor(filePath: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Failed to write file '${filePath}': ${reason}`, {
      ...options,
      code: FileSystemErrorCode.WRITE_FAILED,
      severity: ErrorSeverity.HIGH,
      path: filePath,
      operation: 'write',
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to write file '${this.path}': ${this.context.reason}`;
  }
}

/**
 * File Delete Failed Error
 */
export class FileDeleteError extends FileSystemError {
  constructor(path: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Failed to delete '${path}': ${reason}`, {
      ...options,
      code: FileSystemErrorCode.DELETE_FAILED,
      severity: ErrorSeverity.MEDIUM,
      path,
      operation: 'delete',
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to delete '${this.path}': ${this.context.reason}`;
  }
}

/**
 * File Copy Failed Error
 */
export class FileCopyError extends FileSystemError {
  constructor(
    sourcePath: string,
    destPath: string,
    reason: string,
    options: BaseErrorOptions = {}
  ) {
    super(`Failed to copy '${sourcePath}' to '${destPath}': ${reason}`, {
      ...options,
      code: FileSystemErrorCode.COPY_FAILED,
      severity: ErrorSeverity.MEDIUM,
      path: sourcePath,
      operation: 'copy',
      context: {
        ...options.context,
        sourcePath,
        destPath,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to copy '${this.context.sourcePath}' to '${this.context.destPath}': ${this.context.reason}`;
  }
}

/**
 * File Move Failed Error
 */
export class FileMoveError extends FileSystemError {
  constructor(
    sourcePath: string,
    destPath: string,
    reason: string,
    options: BaseErrorOptions = {}
  ) {
    super(`Failed to move '${sourcePath}' to '${destPath}': ${reason}`, {
      ...options,
      code: FileSystemErrorCode.MOVE_FAILED,
      severity: ErrorSeverity.MEDIUM,
      path: sourcePath,
      operation: 'move',
      context: {
        ...options.context,
        sourcePath,
        destPath,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to move '${this.context.sourcePath}' to '${this.context.destPath}': ${this.context.reason}`;
  }
}

/**
 * Invalid Path Error
 */
export class InvalidPathError extends FileSystemError {
  constructor(path: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Invalid path '${path}': ${reason}`, {
      ...options,
      code: FileSystemErrorCode.INVALID_PATH,
      severity: ErrorSeverity.MEDIUM,
      path,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Invalid path '${this.path}': ${this.context.reason}`;
  }
}

/**
 * Disk Full Error
 */
export class DiskFullError extends FileSystemError {
  constructor(path: string, options: BaseErrorOptions = {}) {
    super(`Disk full while writing to '${path}'`, {
      ...options,
      code: FileSystemErrorCode.DISK_FULL,
      severity: ErrorSeverity.CRITICAL,
      path,
      operation: 'write',
    });
  }

  protected generateUserMessage(): string {
    return `Disk full: Cannot write to '${this.path}'. Please free up disk space.`;
  }
}

/**
 * Not A File Error
 */
export class NotAFileError extends FileSystemError {
  constructor(path: string, options: BaseErrorOptions = {}) {
    super(`Not a file: ${path}`, {
      ...options,
      code: FileSystemErrorCode.NOT_A_FILE,
      severity: ErrorSeverity.MEDIUM,
      path,
    });
  }

  protected generateUserMessage(): string {
    return `'${this.path}' is not a file`;
  }
}

/**
 * Not A Directory Error
 */
export class NotADirectoryError extends FileSystemError {
  constructor(path: string, options: BaseErrorOptions = {}) {
    super(`Not a directory: ${path}`, {
      ...options,
      code: FileSystemErrorCode.NOT_A_DIRECTORY,
      severity: ErrorSeverity.MEDIUM,
      path,
    });
  }

  protected generateUserMessage(): string {
    return `'${this.path}' is not a directory`;
  }
}

/**
 * Directory Not Empty Error
 */
export class DirectoryNotEmptyError extends FileSystemError {
  constructor(dirPath: string, options: BaseErrorOptions = {}) {
    super(`Directory not empty: ${dirPath}`, {
      ...options,
      code: FileSystemErrorCode.DIRECTORY_NOT_EMPTY,
      severity: ErrorSeverity.MEDIUM,
      path: dirPath,
      operation: 'delete',
    });
  }

  protected generateUserMessage(): string {
    return `Directory '${this.path}' is not empty. Use force delete to remove.`;
  }
}
