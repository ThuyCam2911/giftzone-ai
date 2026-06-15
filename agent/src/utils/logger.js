import chalk from 'chalk';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT = LEVELS[process.env.LOG_LEVEL ?? 'info'];

function fmt(level, module, msg, data) {
  const time = new Date().toLocaleTimeString('vi-VN');
  const colors = { debug: 'gray', info: 'white', warn: 'yellow', error: 'red' };
  const prefix = chalk[colors[level]](`[${time}][${level.toUpperCase()}][${module}]`);
  const line = `${prefix} ${msg}`;
  if (data !== undefined) {
    console.log(line, typeof data === 'object' ? JSON.stringify(data) : data);
  } else {
    console.log(line);
  }
}

export function createLogger(module) {
  const log = (level, msg, data) => LEVELS[level] >= CURRENT && fmt(level, module, msg, data);
  return {
    debug: (msg, data) => log('debug', msg, data),
    info:  (msg, data) => log('info',  msg, data),
    warn:  (msg, data) => log('warn',  msg, data),
    error: (msg, data) => log('error', msg, data),
  };
}
