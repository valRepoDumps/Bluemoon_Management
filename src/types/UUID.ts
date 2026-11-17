export type UUID = string;
//DO NOT CHANGE THIS WITHOUT CHANGING DATABASE FIRST!!

export function generateUUID(): UUID {
  return crypto.randomUUID();
  //DO NOT CHANGE THIS WITHOUT CHANGING DATABASE FIRST!!
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUUID(value: unknown): value is UUID {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
