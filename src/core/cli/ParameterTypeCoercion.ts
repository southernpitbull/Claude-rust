/**
 * ParameterTypeCoercion.ts
 *
 * Handles type coercion for command parameters in the AIrchitect application.
 * Converts string parameters to their expected types (number, boolean, etc.).
 */

export interface CoercionResult<T = any> {
  success: boolean;
  value: T | null;
  error?: string;
}

export class ParameterTypeCoercion {
  /**
   * Coerce a parameter value to a boolean
   * @param value - The value to coerce
   * @returns Coercion result with the boolean value
   */
  public static toBoolean(value: any): CoercionResult<boolean> {
    if (typeof value === 'boolean') {
      return { success: true, value };
    }

    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      if (['true', '1', 'yes', 'on', 'enabled', 'active'].includes(lowerValue)) {
        return { success: true, value: true };
      } else if (['false', '0', 'no', 'off', 'disabled', 'inactive'].includes(lowerValue)) {
        return { success: true, value: false };
      }
    }

    if (typeof value === 'number') {
      return { success: true, value: value !== 0 };
    }

    return {
      success: false,
      value: null,
      error: `Cannot coerce "${value}" to boolean`,
    };
  }

  /**
   * Coerce a parameter value to a number
   * @param value - The value to coerce
   * @returns Coercion result with the number value
   */
  public static toNumber(value: any): CoercionResult<number> {
    if (typeof value === 'number') {
      return { success: true, value };
    }

    if (typeof value === 'string') {
      // Handle numeric strings
      const num = Number(value);
      if (!isNaN(num)) {
        return { success: true, value: num };
      }
    }

    return {
      success: false,
      value: null,
      error: `Cannot coerce "${value}" to number`,
    };
  }

  /**
   * Coerce a parameter value to an integer
   * @param value - The value to coerce
   * @returns Coercion result with the integer value
   */
  public static toInteger(value: any): CoercionResult<number> {
    const numberResult = this.toNumber(value);

    if (!numberResult.success) {
      return numberResult;
    }

    const numValue = numberResult.value!;
    if (!Number.isInteger(numValue)) {
      return {
        success: false,
        value: null,
        error: `Value "${value}" is not an integer`,
      };
    }

    return { success: true, value: numValue };
  }

  /**
   * Coerce a parameter value to a float
   * @param value - The value to coerce
   * @returns Coercion result with the float value
   */
  public static toFloat(value: any): CoercionResult<number> {
    const numberResult = this.toNumber(value);

    if (!numberResult.success) {
      return numberResult;
    }

    // Floats are just numbers that may have decimal points
    return numberResult;
  }

  /**
   * Coerce a parameter value to a string
   * @param value - The value to coerce
   * @returns Coercion result with the string value
   */
  public static toString(value: any): CoercionResult<string> {
    if (typeof value === 'string') {
      return { success: true, value };
    }

    if (value === null || value === undefined) {
      return { success: true, value: String(value) };
    }

    // For other types, convert to string representation
    return { success: true, value: String(value) };
  }

  /**
   * Coerce a parameter value to an array of strings
   * @param value - The value to coerce (can be string, array, or comma-separated string)
   * @returns Coercion result with the string array value
   */
  public static toStringArray(value: any): CoercionResult<string[]> {
    if (Array.isArray(value)) {
      // If it's already an array, make sure all elements are strings
      const stringArray = value.map((v) => String(v));
      return { success: true, value: stringArray };
    }

    if (typeof value === 'string') {
      // If it's a comma-separated string, split it
      const stringArray = value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return { success: true, value: stringArray };
    }

    return {
      success: false,
      value: null,
      error: `Cannot coerce "${value}" to string array`,
    };
  }

  /**
   * Coerce a parameter value to a Date object
   * @param value - The value to coerce (string, number, or Date)
   * @returns Coercion result with the Date value
   */
  public static toDate(value: any): CoercionResult<Date> {
    if (value instanceof Date) {
      return { success: true, value };
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return {
          success: false,
          value: null,
          error: `Cannot coerce "${value}" to valid date`,
        };
      }
      return { success: true, value: date };
    }

    return {
      success: false,
      value: null,
      error: `Cannot coerce "${value}" to date`,
    };
  }

  /**
   * Coerce a parameter value to a JSON object
   * @param value - The value to coerce (string or object)
   * @returns Coercion result with the object value
   */
  public static toObject(value: any): CoercionResult<any> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return { success: true, value };
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return { success: true, value: parsed };
        }
      } catch (e) {
        return {
          success: false,
          value: null,
          error: `Cannot coerce "${value}" to valid JSON object: ${(e as Error).message}`,
        };
      }
    }

    return {
      success: false,
      value: null,
      error: `Cannot coerce "${value}" to object`,
    };
  }

  /**
   * Generic coerce function that handles multiple types based on expected type
   * @param value - The value to coerce
   * @param targetType - The target type to coerce to
   * @returns Coercion result with the converted value
   */
  public static coerce(
    value: any,
    targetType: 'boolean' | 'number' | 'integer' | 'float' | 'string' | 'array' | 'date' | 'object'
  ): CoercionResult<any> {
    switch (targetType) {
      case 'boolean':
        return this.toBoolean(value);
      case 'number':
        return this.toNumber(value);
      case 'integer':
        return this.toInteger(value);
      case 'float':
        return this.toFloat(value);
      case 'string':
        return this.toString(value);
      case 'array':
        return this.toStringArray(value);
      case 'date':
        return this.toDate(value);
      case 'object':
        return this.toObject(value);
      default:
        return {
          success: false,
          value: null,
          error: `Unsupported target type: ${targetType}`,
        };
    }
  }

  /**
   * Coerce multiple parameters to their expected types
   * @param params - Object containing parameter values
   * @param typeMap - Object mapping parameter names to expected types
   * @returns Object with coerced values and any errors
   */
  public static coerceMultiple(
    params: Record<string, any>,
    typeMap: Record<
      string,
      'boolean' | 'number' | 'integer' | 'float' | 'string' | 'array' | 'date' | 'object'
    >
  ): { values: Record<string, any>; errors: Record<string, string> } {
    const result: Record<string, any> = {};
    const errors: Record<string, string> = {};

    for (const [paramName, paramValue] of Object.entries(params)) {
      const targetType = typeMap[paramName];
      if (targetType) {
        const coercionResult = this.coerce(paramValue, targetType);
        if (coercionResult.success) {
          result[paramName] = coercionResult.value;
        } else {
          errors[paramName] = coercionResult.error || `Unknown error coercing ${paramName}`;
        }
      } else {
        // If no type specified, just pass through the original value
        result[paramName] = paramValue;
      }
    }

    return { values: result, errors };
  }
}
